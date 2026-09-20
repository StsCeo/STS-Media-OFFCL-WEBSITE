import { centsToDollars } from "@/lib/money";
import { sanitizeText } from "@/lib/validation";
import type { WorkspaceEstimate, WorkspaceEstimateStatus, WorkspaceInvoice } from "@/lib/types";

export const GENERIC_ESTIMATE_ERROR = "The estimate could not be saved.";
export const GENERIC_CONVERT_ERROR = "The estimate could not be converted to an invoice.";
export const ESTIMATE_RECORD_NOTE =
  "Operational customer estimates. Ready records a lifecycle state only. Accepted quotes can create one draft invoice. No email, stored PDF, e-signature, or payment is connected.";

export const ESTIMATE_STATUSES: WorkspaceEstimateStatus[] = [
  "draft",
  "ready",
  "accepted",
  "declined",
  "expired",
];

export const ESTIMATE_STATUS_TRANSITIONS: Record<WorkspaceEstimateStatus, WorkspaceEstimateStatus[]> = {
  draft: ["ready"],
  ready: ["draft", "accepted", "declined", "expired"],
  accepted: [],
  declined: [],
  expired: [],
};

export function canConvertEstimateToInvoice(
  estimate: Pick<WorkspaceEstimate, "status" | "archived">,
) {
  return estimate.status === "accepted" && !estimate.archived;
}

export function addUtcDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function draftInvoiceFromAcceptedEstimate(
  estimate: WorkspaceEstimate,
  invoiceId: string,
  now = new Date().toISOString(),
): WorkspaceInvoice | null {
  if (!canConvertEstimateToInvoice(estimate) || !estimate.lines.length) return null;
  const lines = estimate.lines.map((line, index) => ({
    position: index + 1,
    description: line.description,
    quantity: line.quantity,
    unitCents: line.unitCents,
    lineTotalCents: line.quantity * line.unitCents,
  }));
  const totals = computeInvoiceSnapshotTotals(estimate);
  if (!totals || totals.totalCents !== estimate.totalCents) return null;
  const issueDate = estimate.issueDate || now.slice(0, 10);
  return {
    id: invoiceId,
    invoiceNumber: `DRAFT-${invoiceId.replace(/[^a-zA-Z0-9]/g, "").slice(-16) || Date.now()}`,
    status: "draft",
    clientId: estimate.clientId,
    issueDate,
    dueDate: addUtcDays(issueDate, 15),
    currency: estimate.currency || "USD",
    notes: estimate.customerNotes,
    paymentInstructions: estimate.terms.slice(0, 2000),
    orgLegalName: estimate.orgLegalName,
    orgDisplayName: estimate.orgDisplayName,
    clientBusinessName: estimate.clientBusinessName,
    clientContactName: estimate.clientContactName,
    clientEmail: estimate.clientEmail,
    subtotalCents: totals.subtotalCents,
    discountCents: totals.discountCents,
    taxCents: totals.taxCents,
    totalCents: totals.totalCents,
    amountPaidCents: 0,
    lines,
    sourceEstimateId: estimate.id,
    sourceEstimateNumber: estimate.estimateNumber,
    issuedAt: null,
    paidAt: null,
    voidedAt: null,
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function computeInvoiceSnapshotTotals(estimate: Pick<WorkspaceEstimate, "lines" | "taxCents" | "totalCents">) {
  const subtotalCents = estimate.lines.reduce((sum, line) => sum + line.quantity * line.unitCents, 0);
  const discountCents = estimate.lines.reduce((sum, line) => sum + line.discountCents, 0);
  const taxCents = estimate.taxCents;
  if (discountCents > subtotalCents) return null;
  return {
    subtotalCents,
    discountCents,
    taxCents,
    totalCents: subtotalCents - discountCents + taxCents,
  };
}

export function canTransitionEstimateStatus(
  from: WorkspaceEstimateStatus,
  to: WorkspaceEstimateStatus,
) {
  if (from === to) return true;
  return ESTIMATE_STATUS_TRANSITIONS[from].includes(to);
}

export function derivedEstimateStatus(
  estimate: Pick<WorkspaceEstimate, "status" | "expiresOn" | "archived">,
  today = new Date().toISOString().slice(0, 10),
): WorkspaceEstimateStatus {
  if (estimate.archived) return estimate.status;
  if (estimate.status === "ready" && estimate.expiresOn && estimate.expiresOn < today) return "expired";
  return estimate.status;
}

export function computeEstimateTotals(
  lines: Array<{ quantity: number; unitCents: number; discountCents?: number }>,
  taxCents: number,
) {
  let subtotalCents = 0;
  let discountCents = 0;
  for (const line of lines) {
    const quantity = Math.max(1, Math.trunc(line.quantity));
    const unitCents = Math.max(0, Math.trunc(line.unitCents));
    const discount = Math.max(0, Math.trunc(line.discountCents ?? 0));
    subtotalCents += quantity * unitCents;
    discountCents += discount;
  }
  const tax = Math.max(0, Math.trunc(taxCents));
  return {
    subtotalCents,
    discountCents,
    taxCents: tax,
    totalCents: subtotalCents - discountCents + tax,
  };
}

export function estimateLinesPayload(
  lines: Array<{ description: string; quantity: number; unitCents: number; discountCents?: number }>,
) {
  return lines.map((line) => ({
    description: sanitizeText(line.description).slice(0, 240),
    quantity: Math.max(1, Math.trunc(line.quantity)),
    unit_cents: Math.max(0, Math.trunc(line.unitCents)),
    discount_cents: Math.max(0, Math.trunc(line.discountCents ?? 0)),
  }));
}

export function parseEstimateLinesFromForm(formData: FormData) {
  const descriptions = formData.getAll("lineDescription").map((value) => sanitizeText(String(value)));
  const quantities = formData.getAll("lineQuantity").map((value) => Math.trunc(Number(value)));
  const units = formData.getAll("lineUnit").map((value) => Math.round(Number(String(value).replace(/[^0-9.-]/g, "")) * 100));
  const discounts = formData.getAll("lineDiscount").map((value) => Math.round(Number(String(value).replace(/[^0-9.-]/g, "")) * 100));
  const count = Math.max(descriptions.length, quantities.length, units.length, discounts.length);
  const lines: Array<{ description: string; quantity: number; unitCents: number; discountCents: number }> = [];
  for (let index = 0; index < count; index += 1) {
    const description = descriptions[index] || "";
    const quantity = quantities[index] || 0;
    const unitCents = units[index] || 0;
    const discountCents = discounts[index] || 0;
    if (!description && quantity <= 0 && unitCents <= 0 && discountCents <= 0) continue;
    lines.push({
      description: description.slice(0, 240),
      quantity,
      unitCents,
      discountCents,
    });
  }
  return lines;
}

export function validateEstimateLines(
  lines: Array<{ description: string; quantity: number; unitCents: number; discountCents: number }>,
) {
  if (lines.length < 1 || lines.length > 100) return "Add between 1 and 100 line items.";
  for (const line of lines) {
    if (!line.description) return "Each line item needs a description.";
    if (line.quantity < 1 || line.quantity > 9999) return "Line quantities must be whole numbers from 1 to 9,999.";
    if (line.unitCents < 0 || line.unitCents > 99_999_999) return "Unit prices must be zero or a reasonable positive amount.";
    if (line.discountCents < 0 || line.discountCents > line.quantity * line.unitCents) {
      return "Line discounts must be zero or less than the line amount.";
    }
  }
  return null;
}

export function estimateTotalsLabel(estimate: WorkspaceEstimate) {
  return {
    subtotal: centsToDollars(estimate.subtotalCents),
    discount: centsToDollars(estimate.discountCents),
    tax: centsToDollars(estimate.taxCents),
    total: centsToDollars(estimate.totalCents),
  };
}

export function estimateSummaries(
  estimates: WorkspaceEstimate[],
  today = new Date().toISOString().slice(0, 10),
) {
  const live = estimates.filter((item) => !item.archived);
  const draftEstimates = live.filter((item) => item.status === "draft").length;
  const readyEstimates = live.filter((item) => derivedEstimateStatus(item, today) === "ready").length;
  const acceptedCents = live
    .filter((item) => item.status === "accepted")
    .reduce((sum, item) => sum + item.totalCents, 0);
  const expiredEstimates = live.filter((item) => derivedEstimateStatus(item, today) === "expired").length;
  return {
    draftEstimates,
    readyEstimates,
    acceptedEstimateTotal: centsToDollars(acceptedCents),
    expiredEstimates,
  };
}

export function matchesEstimateSearch(estimate: WorkspaceEstimate, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    estimate.estimateNumber,
    estimate.title,
    estimate.clientBusinessName,
    estimate.clientContactName,
    estimate.clientEmail,
    estimate.status,
  ]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

import { centsToDollars } from "@/lib/money";
import { sanitizeText } from "@/lib/validation";
import { safeObjectFileName } from "@/lib/security/files";
import type { CalendarEvent, EventKind, OsDocument, WorkspaceInvoice } from "@/lib/types";

export const GENERIC_WORKSPACE_ERROR = "The record could not be saved.";
export const WORKSPACE_RECORD_NOTE =
  "Operational records for this organization. Not a formal accounting or tax report.";
export const DOCUMENT_SCAN_NOTE =
  "Antivirus and malware scanning is not implemented. Only PDF, PNG, JPEG, and plain text up to 8MB are accepted.";
export const INVOICE_RECORD_NOTE =
  "Operational invoice records. Issued and paid are recorded in this system only. No payment processor, email delivery, or tax filing is connected.";
export const EVENT_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "UTC",
] as const;
export const EVENT_KINDS: EventKind[] = [
  "team_meeting",
  "client_meeting",
  "deadline",
  "follow_up",
  "content",
  "invoice_due",
  "domain_renewal",
  "subscription_renewal",
  "task",
];
export const DOCUMENT_CATEGORIES: OsDocument["category"][] = [
  "contract",
  "formation",
  "tax",
  "insurance",
  "other",
];

export function sanitizeNoteBody(value: string) {
  return sanitizeText(value).slice(0, 8000);
}

export function derivedInvoiceStatus(
  invoice: Pick<WorkspaceInvoice, "status" | "dueDate" | "archived">,
  today = new Date().toISOString().slice(0, 10),
) {
  if (invoice.archived) return invoice.status;
  if (invoice.status === "issued" && invoice.dueDate && invoice.dueDate < today) return "overdue";
  return invoice.status;
}

export function generatedDocumentPath(organizationId: string, documentId: string, fileName: string) {
  return `${organizationId}/${documentId}/${safeObjectFileName(fileName)}`;
}

export function parseCalendarBounds(input: {
  start: string;
  end: string;
  allDay: boolean;
  timezone: string;
}): { startAt: string; endAt: string } | { error: string } {
  const timezone = EVENT_TIMEZONES.includes(input.timezone as (typeof EVENT_TIMEZONES)[number])
    ? input.timezone
    : "";
  if (!timezone) return { error: "Choose a supported timezone." };
  if (input.allDay) {
    const startDate = input.start.slice(0, 10);
    const endDate = (input.end || input.start).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return { error: "All-day events need a start and end date." };
    }
    if (endDate < startDate) return { error: "The end date cannot be before the start date." };
    return {
      startAt: `${startDate}T00:00:00.000Z`,
      endAt: `${endDate}T23:59:59.000Z`,
    };
  }
  const startAt = new Date(input.start);
  const endAt = new Date(input.end);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return { error: "Enter a valid start and end time." };
  }
  if (endAt.getTime() < startAt.getTime()) {
    return { error: "The end time cannot be before the start time." };
  }
  return { startAt: startAt.toISOString(), endAt: endAt.toISOString() };
}

export function formatEventInstant(value: string, timezone: string, allDay = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  if (allDay) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "UTC",
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function eventFallsOnDay(event: CalendarEvent, day: Date) {
  const dayKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  if (event.allDay) return event.start.slice(0, 10) === dayKey;
  try {
    return (
      new Intl.DateTimeFormat("en-CA", {
        timeZone: event.timezone || "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(event.start)) === dayKey
    );
  } catch {
    return event.start.slice(0, 10) === dayKey;
  }
}

export function computeInvoiceTotals(
  lines: Array<{ quantity: number; unitCents: number }>,
  discountCents: number,
  taxCents: number,
) {
  const subtotalCents = lines.reduce(
    (sum, line) => sum + Math.max(1, Math.trunc(line.quantity)) * Math.max(0, Math.trunc(line.unitCents)),
    0,
  );
  const discount = Math.max(0, Math.trunc(discountCents));
  const tax = Math.max(0, Math.trunc(taxCents));
  return {
    subtotalCents,
    discountCents: discount,
    taxCents: tax,
    totalCents: subtotalCents - discount + tax,
  };
}

export function invoiceLinesPayload(lines: Array<{ description: string; quantity: number; unitCents: number }>) {
  return lines.map((line) => ({
    description: sanitizeText(line.description).slice(0, 240),
    quantity: Math.max(1, Math.trunc(line.quantity)),
    unit_cents: Math.max(0, Math.trunc(line.unitCents)),
  }));
}

export function parseInvoiceLinesFromForm(formData: FormData) {
  const descriptions = formData.getAll("lineDescription").map((value) => sanitizeText(String(value)));
  const quantities = formData.getAll("lineQuantity").map((value) => Math.trunc(Number(value)));
  const units = formData.getAll("lineUnit").map((value) => Math.round(Number(String(value).replace(/[^0-9.-]/g, "")) * 100));
  const count = Math.max(descriptions.length, quantities.length, units.length);
  const lines: Array<{ description: string; quantity: number; unitCents: number }> = [];
  for (let index = 0; index < count; index += 1) {
    const description = descriptions[index] || "";
    const quantity = quantities[index] || 0;
    const unitCents = units[index] || 0;
    if (!description && quantity <= 0 && unitCents <= 0) continue;
    lines.push({
      description: description.slice(0, 240),
      quantity,
      unitCents,
    });
  }
  return lines;
}

export function validateInvoiceLines(lines: Array<{ description: string; quantity: number; unitCents: number }>) {
  if (lines.length < 1 || lines.length > 100) return "Add between 1 and 100 line items.";
  for (const line of lines) {
    if (!line.description) return "Each line item needs a description.";
    if (line.quantity < 1 || line.quantity > 9999) return "Line quantities must be whole numbers from 1 to 9,999.";
    if (line.unitCents < 0 || line.unitCents > 99_999_999) return "Unit prices must be zero or a reasonable positive amount.";
  }
  return null;
}

export function invoiceTotalsLabel(invoice: WorkspaceInvoice) {
  return {
    subtotal: centsToDollars(invoice.subtotalCents),
    discount: centsToDollars(invoice.discountCents),
    tax: centsToDollars(invoice.taxCents),
    total: centsToDollars(invoice.totalCents),
    paid: centsToDollars(invoice.amountPaidCents),
  };
}

export function workspaceSummaries(input: {
  notes: Array<{ updatedAt: string }>;
  documents: unknown[];
  events: CalendarEvent[];
  invoices: WorkspaceInvoice[];
  now?: Date;
}) {
  const today = (input.now ?? new Date()).toISOString().slice(0, 10);
  const upcoming = input.events.filter((event) => event.start.slice(0, 10) >= today).slice(0, 5);
  const recentNotes = [...input.notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
  const liveInvoices = input.invoices.filter((item) => !item.archived);
  const draftInvoices = liveInvoices.filter((item) => item.status === "draft").length;
  const outstandingCents = liveInvoices
    .filter((item) => item.status === "issued")
    .reduce((sum, item) => sum + item.totalCents, 0);
  const overdueCents = liveInvoices
    .filter((item) => item.status === "issued" && item.dueDate && item.dueDate < today)
    .reduce((sum, item) => sum + item.totalCents, 0);
  const paidCents = liveInvoices
    .filter((item) => item.status === "paid")
    .reduce((sum, item) => sum + item.amountPaidCents, 0);
  return {
    upcomingEvents: upcoming,
    recentNotes,
    documentCount: input.documents.length,
    draftInvoices,
    outstandingInvoiceTotal: centsToDollars(outstandingCents),
    overdueInvoiceTotal: centsToDollars(overdueCents),
    paidInvoiceTotal: centsToDollars(paidCents),
  };
}

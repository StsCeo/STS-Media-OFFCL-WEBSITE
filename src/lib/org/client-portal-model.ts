import { formatCents } from "@/lib/money";

export const CLIENT_PORTAL_READONLY_NOTE =
  "This portal is read-only. Payments, signatures, messaging, uploads, and status changes are not available here.";
export const CLIENT_PORTAL_RECORD_NOTE =
  "Only records an owner or administrator has published for your business are listed. Unpublished or archived records are not shown.";
export const CLIENT_PORTAL_MAPPING_NOTE =
  "A client user can be linked to one CRM client in this organization. The mapping is unique, must stay active, and cannot be changed from this portal.";
export const CLIENT_PORTAL_PUBLISH_NOTE =
  "Publishing one record does not publish related estimates, invoices, projects, or documents. Archived records cannot be newly published. Unpublishing removes portal access immediately.";

export const CLIENT_PORTAL_SOURCE_TYPES = ["estimate", "invoice", "project", "document"] as const;
export type ClientPortalSourceType = (typeof CLIENT_PORTAL_SOURCE_TYPES)[number];

export type ClientPortalProfile = {
  organizationDisplayName: string;
  organizationLegalName: string;
  clientBusinessName: string;
  clientContactName: string;
};

export type ClientPortalEstimate = {
  id: string;
  estimateNumber: string;
  status: string;
  title: string;
  description: string;
  issueDate: string | null;
  expiresOn: string | null;
  currency: string;
  customerNotes: string;
  terms: string;
  orgLegalName: string;
  orgDisplayName: string;
  clientBusinessName: string;
  clientContactName: string;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  publishedAt: string | null;
  lines: ClientPortalLine[];
};

export type ClientPortalInvoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: string | null;
  dueDate: string | null;
  currency: string;
  orgLegalName: string;
  orgDisplayName: string;
  clientBusinessName: string;
  clientContactName: string;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  publishedAt: string | null;
  lines: ClientPortalLine[];
};

export type ClientPortalLine = {
  parentId: string;
  position: number;
  description: string;
  quantity: number;
  unitCents: number;
  discountCents: number;
  lineTotalCents: number;
};

export type ClientPortalProject = {
  id: string;
  name: string;
  description: string;
  status: string;
  startDate: string | null;
  deadline: string | null;
  publishedAt: string | null;
};

export type ClientPortalDocument = {
  id: string;
  title: string;
  description: string;
  contentType: string;
  byteSize: number;
  createdAt: string | null;
  publishedAt: string | null;
};

export type ClientPortalIdentity = {
  id: string;
  crmClientId: string;
  clientBusinessName: string;
  userEmail: string;
  status: "active" | "disabled";
  createdAt: string | null;
};

export type ClientPortalCandidate = {
  userId: string;
  userEmail: string;
  mapped: boolean;
};

export type ClientPortalPublication = {
  id: string;
  sourceType: ClientPortalSourceType;
  sourceId: string;
  crmClientId: string;
  clientBusinessName: string;
  published: boolean;
  publishedAt: string | null;
  unpublishedAt: string | null;
};

export type ClientPortalVisibility = {
  sourceType: ClientPortalSourceType;
  sourceId: string;
  published: boolean;
  mappingActive: boolean;
  archived: boolean;
  clientBusinessName: string;
  canPublish: boolean;
};

export function isClientPortalSourceType(value: string | null | undefined): value is ClientPortalSourceType {
  return Boolean(value && (CLIENT_PORTAL_SOURCE_TYPES as readonly string[]).includes(value));
}

function text(value: unknown) {
  return String(value ?? "");
}

function cents(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

function dateOnly(value: unknown) {
  if (!value) return null;
  return String(value).slice(0, 10) || null;
}

export function mapClientPortalProfile(row: Record<string, unknown>): ClientPortalProfile {
  return {
    organizationDisplayName: text(row.organization_display_name),
    organizationLegalName: text(row.organization_legal_name),
    clientBusinessName: text(row.client_business_name),
    clientContactName: text(row.client_contact_name),
  };
}

export function mapClientPortalEstimate(
  row: Record<string, unknown>,
  lines: ClientPortalLine[] = [],
): ClientPortalEstimate {
  return {
    id: text(row.id),
    estimateNumber: text(row.estimate_number),
    status: text(row.status),
    title: text(row.title),
    description: text(row.description),
    issueDate: dateOnly(row.issue_date),
    expiresOn: dateOnly(row.expires_on),
    currency: text(row.currency) || "USD",
    customerNotes: text(row.customer_notes),
    terms: text(row.terms),
    orgLegalName: text(row.org_legal_name),
    orgDisplayName: text(row.org_display_name),
    clientBusinessName: text(row.client_business_name),
    clientContactName: text(row.client_contact_name),
    subtotalCents: cents(row.subtotal_cents),
    discountCents: cents(row.discount_cents),
    taxCents: cents(row.tax_cents),
    totalCents: cents(row.total_cents),
    publishedAt: row.published_at ? String(row.published_at) : null,
    lines,
  };
}

export function mapClientPortalInvoice(
  row: Record<string, unknown>,
  lines: ClientPortalLine[] = [],
): ClientPortalInvoice {
  return {
    id: text(row.id),
    invoiceNumber: text(row.invoice_number),
    status: text(row.status),
    issueDate: dateOnly(row.issue_date),
    dueDate: dateOnly(row.due_date),
    currency: text(row.currency) || "USD",
    orgLegalName: text(row.org_legal_name),
    orgDisplayName: text(row.org_display_name),
    clientBusinessName: text(row.client_business_name),
    clientContactName: text(row.client_contact_name),
    subtotalCents: cents(row.subtotal_cents),
    discountCents: cents(row.discount_cents),
    taxCents: cents(row.tax_cents),
    totalCents: cents(row.total_cents),
    publishedAt: row.published_at ? String(row.published_at) : null,
    lines,
  };
}

export function mapClientPortalEstimateLine(row: Record<string, unknown>): ClientPortalLine {
  return {
    parentId: text(row.estimate_id),
    position: Number(row.line_position || row.position || 1),
    description: text(row.description),
    quantity: Number(row.quantity || 1),
    unitCents: cents(row.unit_cents),
    discountCents: cents(row.discount_cents),
    lineTotalCents: cents(row.line_total_cents),
  };
}

export function mapClientPortalInvoiceLine(row: Record<string, unknown>): ClientPortalLine {
  return {
    parentId: text(row.invoice_id),
    position: Number(row.line_position || row.position || 1),
    description: text(row.description),
    quantity: Number(row.quantity || 1),
    unitCents: cents(row.unit_cents),
    discountCents: 0,
    lineTotalCents: cents(row.line_total_cents),
  };
}

export function mapClientPortalProject(row: Record<string, unknown>): ClientPortalProject {
  return {
    id: text(row.id),
    name: text(row.name),
    description: text(row.description),
    status: text(row.status),
    startDate: dateOnly(row.start_date),
    deadline: dateOnly(row.deadline),
    publishedAt: row.published_at ? String(row.published_at) : null,
  };
}

export function mapClientPortalDocument(row: Record<string, unknown>): ClientPortalDocument {
  return {
    id: text(row.id),
    title: text(row.title),
    description: text(row.description),
    contentType: text(row.content_type),
    byteSize: Number(row.byte_size || 0),
    createdAt: row.created_at ? String(row.created_at) : null,
    publishedAt: row.published_at ? String(row.published_at) : null,
  };
}

export function mapClientPortalIdentity(row: Record<string, unknown>): ClientPortalIdentity {
  const status = text(row.status) === "disabled" ? "disabled" : "active";
  return {
    id: text(row.id),
    crmClientId: text(row.crm_client_id),
    clientBusinessName: text(row.client_business_name),
    userEmail: text(row.user_email),
    status,
    createdAt: row.created_at ? String(row.created_at) : null,
  };
}

export function mapClientPortalCandidate(row: Record<string, unknown>): ClientPortalCandidate {
  return {
    userId: text(row.user_id),
    userEmail: text(row.user_email),
    mapped: Boolean(row.mapped),
  };
}

export function mapClientPortalPublication(row: Record<string, unknown>): ClientPortalPublication | null {
  const sourceType = text(row.source_type);
  if (!isClientPortalSourceType(sourceType)) return null;
  return {
    id: text(row.id),
    sourceType,
    sourceId: text(row.source_id),
    crmClientId: text(row.crm_client_id),
    clientBusinessName: text(row.client_business_name),
    published: Boolean(row.published),
    publishedAt: row.published_at ? String(row.published_at) : null,
    unpublishedAt: row.unpublished_at ? String(row.unpublished_at) : null,
  };
}

export function mapClientPortalVisibility(row: Record<string, unknown>): ClientPortalVisibility | null {
  const sourceType = text(row.source_type);
  if (!isClientPortalSourceType(sourceType)) return null;
  return {
    sourceType,
    sourceId: text(row.source_id),
    published: Boolean(row.published),
    mappingActive: Boolean(row.mapping_active),
    archived: Boolean(row.archived),
    clientBusinessName: text(row.client_business_name),
    canPublish: Boolean(row.can_publish),
  };
}

export function attachLines<T extends { id: string }, R extends T>(
  records: T[],
  lines: ClientPortalLine[],
  assign: (record: T, recordLines: ClientPortalLine[]) => R,
): R[] {
  return records.map((record) =>
    assign(
      record,
      lines.filter((line) => line.parentId === record.id).sort((a, b) => a.position - b.position),
    ),
  );
}

export function moneyLabel(amountCents: number, currency = "USD") {
  return formatCents(amountCents, currency);
}

export function publicationKey(sourceType: string, sourceId: string) {
  return `${sourceType}:${sourceId}`;
}

export const CLIENT_PORTAL_WITHHELD_COLUMNS = [
  "internal_notes",
  "notes",
  "payment_instructions",
  "payment_account",
  "payment_method",
  "client_email",
  "client_id",
  "project_id",
  "storage_path",
  "budget_cents",
  "amount_invoiced_cents",
  "amount_collected_cents",
  "direct_cost_cents",
  "assigned_member_id",
  "assigned_to",
  "uploaded_by",
] as const;

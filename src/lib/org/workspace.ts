import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/config";
import { sanitizeText } from "@/lib/validation";
import type { SessionUser } from "@/lib/auth/session";
import type {
  CalendarEvent,
  EventKind,
  NoteRelatedType,
  OsDocument,
  OwnerNote,
  WorkspaceInvoice,
  WorkspaceInvoiceLine,
  WorkspaceInvoiceStatus,
} from "@/lib/types";
import {
  invoiceLinesPayload,
  sanitizeNoteBody,
} from "@/lib/org/workspace-model";

export {
  DOCUMENT_CATEGORIES,
  DOCUMENT_SCAN_NOTE,
  EVENT_KINDS,
  EVENT_TIMEZONES,
  GENERIC_WORKSPACE_ERROR,
  INVOICE_RECORD_NOTE,
  WORKSPACE_RECORD_NOTE,
  computeInvoiceTotals,
  derivedInvoiceStatus,
  eventFallsOnDay,
  formatEventInstant,
  generatedDocumentPath,
  invoiceLinesPayload,
  invoiceTotalsLabel,
  parseCalendarBounds,
  parseInvoiceLinesFromForm,
  sanitizeNoteBody,
  validateInvoiceLines,
  workspaceSummaries,
} from "@/lib/org/workspace-model";

export const NOTE_SAVE_RPC = "sts_save_ws_note";
export const NOTE_ARCHIVE_RPC = "sts_archive_ws_note";
export const DOCUMENT_SAVE_RPC = "sts_save_ws_document";
export const DOCUMENT_ARCHIVE_RPC = "sts_archive_ws_document";
export const CALENDAR_SAVE_RPC = "sts_save_ws_calendar_event";
export const CALENDAR_ARCHIVE_RPC = "sts_archive_ws_calendar_event";
export const INVOICE_SAVE_RPC = "sts_save_ws_invoice";
export const INVOICE_ISSUE_RPC = "sts_issue_ws_invoice";
export const INVOICE_PAY_RPC = "sts_record_ws_invoice_payment";
export const INVOICE_VOID_RPC = "sts_void_ws_invoice";
export const INVOICE_ARCHIVE_RPC = "sts_archive_ws_invoice";
export const ORG_DOCUMENTS_BUCKET = "org-documents";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPersistedWorkspaceId(value: string | null | undefined): value is string {
  return Boolean(value && UUID_RE.test(value));
}

export function shouldUseWorkspaceDatabase(user: SessionUser | null | undefined) {
  return Boolean(
    user?.source === "supabase" &&
      isSupabaseConfigured() &&
      user.organizationId &&
      user.membershipStatus === "active",
  );
}

function optionalUuid(value: string | null | undefined) {
  return isPersistedWorkspaceId(value) ? value : null;
}

export function mapNoteRow(row: Record<string, unknown>): OwnerNote {
  const relatedType = (["client", "lead", "project", "task", "none"] as const).includes(row.related_type as NoteRelatedType)
    ? (row.related_type as NoteRelatedType)
    : "none";
  return {
    id: String(row.id),
    title: String(row.title),
    body: String(row.body),
    relatedType,
    relatedId: (row.related_id as string | null) ?? null,
    pinned: Boolean(row.pinned),
    author: (row.created_by as string | null) ?? null,
    archived: Boolean(row.archived_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapDocumentRow(row: Record<string, unknown>): OsDocument {
  return {
    id: String(row.id),
    name: String(row.display_filename),
    category: (row.category as OsDocument["category"]) || "other",
    relatedType: row.client_id ? "client" : row.project_id ? "project" : "none",
    relatedId: (row.client_id as string | null) ?? (row.project_id as string | null) ?? null,
    notes: String(row.description || ""),
    storagePath: String(row.storage_path),
    contentType: String(row.content_type || ""),
    byteSize: Number(row.byte_size || 0),
    archived: Boolean(row.archived_at),
    createdAt: String(row.created_at),
  };
}

export function mapCalendarRow(row: Record<string, unknown>): CalendarEvent {
  return {
    id: String(row.id),
    title: String(row.title),
    kind: (row.kind as EventKind) || "team_meeting",
    start: String(row.start_at),
    end: String(row.end_at),
    notes: String(row.description || ""),
    relatedId: (row.project_id as string | null) ?? (row.client_id as string | null) ?? null,
    location: String(row.location || ""),
    allDay: Boolean(row.all_day),
    timezone: String(row.timezone || "America/New_York"),
    clientId: (row.client_id as string | null) ?? null,
    projectId: (row.project_id as string | null) ?? null,
  };
}

export function mapInvoiceLineRow(row: Record<string, unknown>): WorkspaceInvoiceLine {
  return {
    id: String(row.id),
    position: Number(row.position || 1),
    description: String(row.description),
    quantity: Number(row.quantity || 1),
    unitCents: Number(row.unit_cents || 0),
    lineTotalCents: Number(row.line_total_cents || 0),
  };
}

export function mapInvoiceRow(row: Record<string, unknown>, lines: WorkspaceInvoiceLine[] = []): WorkspaceInvoice {
  return {
    id: String(row.id),
    invoiceNumber: String(row.invoice_number),
    status: (row.status as WorkspaceInvoiceStatus) || "draft",
    clientId: (row.client_id as string | null) ?? null,
    issueDate: row.issue_date ? String(row.issue_date) : null,
    dueDate: row.due_date ? String(row.due_date) : null,
    currency: String(row.currency || "USD"),
    notes: String(row.notes || ""),
    paymentInstructions: String(row.payment_instructions || ""),
    orgLegalName: String(row.org_legal_name || ""),
    orgDisplayName: String(row.org_display_name || ""),
    clientBusinessName: String(row.client_business_name || ""),
    clientContactName: String(row.client_contact_name || ""),
    clientEmail: String(row.client_email || ""),
    subtotalCents: Number(row.subtotal_cents || 0),
    discountCents: Number(row.discount_cents || 0),
    taxCents: Number(row.tax_cents || 0),
    totalCents: Number(row.total_cents || 0),
    amountPaidCents: Number(row.amount_paid_cents || 0),
    lines,
    issuedAt: row.issued_at ? String(row.issued_at) : null,
    paidAt: row.paid_at ? String(row.paid_at) : null,
    voidedAt: row.voided_at ? String(row.voided_at) : null,
    archived: Boolean(row.archived_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listWorkspaceNotes(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from("ws_notes")
    .select("*")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) return { error: true as const };
  return (data ?? []).map((row) => mapNoteRow(row as Record<string, unknown>));
}

export async function listWorkspaceDocuments(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from("ws_documents")
    .select("*")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });
  if (error) return { error: true as const };
  return (data ?? []).map((row) => mapDocumentRow(row as Record<string, unknown>));
}

export async function listWorkspaceEvents(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from("ws_calendar_events")
    .select("*")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("start_at", { ascending: true });
  if (error) return { error: true as const };
  return (data ?? []).map((row) => mapCalendarRow(row as Record<string, unknown>));
}

export async function listWorkspaceInvoices(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from("ws_invoices")
    .select("*")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });
  if (error) return { error: true as const };
  const invoices = (data ?? []).map((row) => mapInvoiceRow(row as Record<string, unknown>));
  if (!invoices.length) return invoices;
  const { data: lines, error: lineError } = await supabase
    .from("ws_invoice_lines")
    .select("*")
    .eq("organization_id", organizationId)
    .in("invoice_id", invoices.map((item) => item.id))
    .order("position", { ascending: true });
  if (lineError) return { error: true as const };
  const grouped = new Map<string, WorkspaceInvoiceLine[]>();
  for (const row of lines ?? []) {
    const mapped = mapInvoiceLineRow(row as Record<string, unknown>);
    const list = grouped.get(String((row as { invoice_id: string }).invoice_id)) ?? [];
    list.push(mapped);
    grouped.set(String((row as { invoice_id: string }).invoice_id), list);
  }
  return invoices.map((invoice) => ({ ...invoice, lines: grouped.get(invoice.id) ?? [] }));
}

async function rpcId(supabase: SupabaseClient, name: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, args);
  if (error || !data) return { error: true as const };
  return { id: String(data) };
}

export async function saveWorkspaceNote(
  supabase: SupabaseClient,
  organizationId: string,
  input: {
    id?: string;
    title: string;
    body: string;
    relatedType: NoteRelatedType;
    relatedId: string | null;
    pinned: boolean;
  },
) {
  return rpcId(supabase, NOTE_SAVE_RPC, {
    p_organization_id: organizationId,
    p_id: optionalUuid(input.id),
    p_title: sanitizeText(input.title).slice(0, 160),
    p_body: sanitizeNoteBody(input.body),
    p_related_type: input.relatedType,
    p_related_id: optionalUuid(input.relatedId),
    p_pinned: input.pinned,
  });
}

export async function archiveWorkspaceNote(supabase: SupabaseClient, organizationId: string, id: string) {
  return rpcId(supabase, NOTE_ARCHIVE_RPC, { p_organization_id: organizationId, p_id: id });
}

export async function saveWorkspaceDocument(
  supabase: SupabaseClient,
  organizationId: string,
  input: {
    id?: string;
    storagePath: string;
    displayFilename: string;
    contentType: string;
    byteSize: number;
    description: string;
    category: OsDocument["category"];
    clientId: string | null;
    projectId: string | null;
  },
) {
  return rpcId(supabase, DOCUMENT_SAVE_RPC, {
    p_organization_id: organizationId,
    p_id: optionalUuid(input.id),
    p_storage_path: input.storagePath,
    p_display_filename: sanitizeText(input.displayFilename).slice(0, 180),
    p_content_type: input.contentType,
    p_byte_size: input.byteSize,
    p_description: sanitizeText(input.description).slice(0, 2000),
    p_category: input.category,
    p_client_id: optionalUuid(input.clientId),
    p_project_id: optionalUuid(input.projectId),
  });
}

export async function archiveWorkspaceDocument(supabase: SupabaseClient, organizationId: string, id: string) {
  return rpcId(supabase, DOCUMENT_ARCHIVE_RPC, { p_organization_id: organizationId, p_id: id });
}

export async function saveWorkspaceEvent(
  supabase: SupabaseClient,
  organizationId: string,
  input: {
    id?: string;
    title: string;
    description: string;
    startAt: string;
    endAt: string;
    allDay: boolean;
    timezone: string;
    clientId: string | null;
    projectId: string | null;
    location: string;
    kind: EventKind;
  },
) {
  return rpcId(supabase, CALENDAR_SAVE_RPC, {
    p_organization_id: organizationId,
    p_id: optionalUuid(input.id),
    p_title: sanitizeText(input.title).slice(0, 160),
    p_description: sanitizeText(input.description).slice(0, 4000),
    p_start_at: input.startAt,
    p_end_at: input.endAt,
    p_all_day: input.allDay,
    p_timezone: input.timezone,
    p_client_id: optionalUuid(input.clientId),
    p_project_id: optionalUuid(input.projectId),
    p_location: sanitizeText(input.location).slice(0, 240),
    p_kind: input.kind,
  });
}

export async function archiveWorkspaceEvent(supabase: SupabaseClient, organizationId: string, id: string) {
  return rpcId(supabase, CALENDAR_ARCHIVE_RPC, { p_organization_id: organizationId, p_id: id });
}

export async function saveWorkspaceInvoice(
  supabase: SupabaseClient,
  organizationId: string,
  input: {
    id?: string;
    clientId: string | null;
    issueDate: string | null;
    dueDate: string | null;
    currency: string;
    notes: string;
    paymentInstructions: string;
    discountCents: number;
    taxCents: number;
    lines: Array<{ description: string; quantity: number; unitCents: number }>;
  },
) {
  return rpcId(supabase, INVOICE_SAVE_RPC, {
    p_organization_id: organizationId,
    p_id: optionalUuid(input.id),
    p_client_id: optionalUuid(input.clientId),
    p_issue_date: input.issueDate,
    p_due_date: input.dueDate,
    p_currency: input.currency || "USD",
    p_notes: sanitizeText(input.notes).slice(0, 4000),
    p_payment_instructions: sanitizeText(input.paymentInstructions).slice(0, 2000),
    p_discount_cents: Math.max(0, Math.trunc(input.discountCents)),
    p_tax_cents: Math.max(0, Math.trunc(input.taxCents)),
    p_lines: invoiceLinesPayload(input.lines),
  });
}

export async function issueWorkspaceInvoice(supabase: SupabaseClient, organizationId: string, id: string) {
  return rpcId(supabase, INVOICE_ISSUE_RPC, { p_organization_id: organizationId, p_id: id });
}

export async function recordWorkspaceInvoicePayment(supabase: SupabaseClient, organizationId: string, id: string) {
  return rpcId(supabase, INVOICE_PAY_RPC, { p_organization_id: organizationId, p_id: id });
}

export async function voidWorkspaceInvoice(supabase: SupabaseClient, organizationId: string, id: string) {
  return rpcId(supabase, INVOICE_VOID_RPC, { p_organization_id: organizationId, p_id: id });
}

export async function archiveWorkspaceInvoice(supabase: SupabaseClient, organizationId: string, id: string) {
  return rpcId(supabase, INVOICE_ARCHIVE_RPC, { p_organization_id: organizationId, p_id: id });
}

export async function createSignedDocumentUrl(supabase: SupabaseClient, storagePath: string, expiresIn = 60) {
  const { data, error } = await supabase.storage.from(ORG_DOCUMENTS_BUCKET).createSignedUrl(storagePath, expiresIn);
  if (error || !data?.signedUrl) return { error: true as const };
  return { url: data.signedUrl };
}

export function newDocumentId() {
  return randomUUID();
}

export async function loadWorkspaceNote(supabase: SupabaseClient, organizationId: string, id: string) {
  const { data, error } = await supabase
    .from("ws_notes")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();
  if (error) return { error: true as const };
  return data ? mapNoteRow(data as Record<string, unknown>) : null;
}

export async function loadWorkspaceDocument(supabase: SupabaseClient, organizationId: string, id: string) {
  const { data, error } = await supabase
    .from("ws_documents")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();
  if (error) return { error: true as const };
  return data ? mapDocumentRow(data as Record<string, unknown>) : null;
}

export async function loadWorkspaceEvent(supabase: SupabaseClient, organizationId: string, id: string) {
  const { data, error } = await supabase
    .from("ws_calendar_events")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();
  if (error) return { error: true as const };
  return data ? mapCalendarRow(data as Record<string, unknown>) : null;
}

export async function loadWorkspaceInvoice(supabase: SupabaseClient, organizationId: string, id: string) {
  const { data, error } = await supabase
    .from("ws_invoices")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();
  if (error) return { error: true as const };
  if (!data) return null;
  const { data: lines, error: lineError } = await supabase
    .from("ws_invoice_lines")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("invoice_id", id)
    .order("position", { ascending: true });
  if (lineError) return { error: true as const };
  return mapInvoiceRow(
    data as Record<string, unknown>,
    (lines ?? []).map((row) => mapInvoiceLineRow(row as Record<string, unknown>)),
  );
}

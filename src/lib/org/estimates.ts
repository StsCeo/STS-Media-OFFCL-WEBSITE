import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeText } from "@/lib/validation";
import type { SessionUser } from "@/lib/auth/session";
import type { WorkspaceEstimate, WorkspaceEstimateLine, WorkspaceEstimateStatus } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/config";
import { estimateLinesPayload } from "@/lib/org/estimates-model";

export {
  ESTIMATE_RECORD_NOTE,
  ESTIMATE_STATUSES,
  ESTIMATE_STATUS_TRANSITIONS,
  GENERIC_ESTIMATE_ERROR,
  canTransitionEstimateStatus,
  computeEstimateTotals,
  derivedEstimateStatus,
  estimateLinesPayload,
  estimateSummaries,
  estimateTotalsLabel,
  matchesEstimateSearch,
  parseEstimateLinesFromForm,
  validateEstimateLines,
} from "@/lib/org/estimates-model";

export const ESTIMATE_SAVE_RPC = "sts_save_ws_estimate";
export const ESTIMATE_STATUS_RPC = "sts_set_ws_estimate_status";
export const ESTIMATE_ARCHIVE_RPC = "sts_archive_ws_estimate";
export const ESTIMATE_RESTORE_RPC = "sts_restore_ws_estimate";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function optionalUuid(value: string | null | undefined) {
  return value && UUID_RE.test(value) ? value : null;
}

export function shouldUseEstimateDatabase(user: SessionUser | null | undefined) {
  return Boolean(
    user?.source === "supabase" &&
      isSupabaseConfigured() &&
      user.organizationId &&
      user.membershipStatus === "active" &&
      user.mfaVerified,
  );
}

export function mapEstimateLineRow(row: Record<string, unknown>): WorkspaceEstimateLine {
  return {
    id: String(row.id),
    position: Number(row.position || 1),
    description: String(row.description),
    quantity: Number(row.quantity || 1),
    unitCents: Number(row.unit_cents || 0),
    discountCents: Number(row.discount_cents || 0),
    lineTotalCents: Number(row.line_total_cents || 0),
  };
}

export function mapEstimateRow(row: Record<string, unknown>, lines: WorkspaceEstimateLine[] = []): WorkspaceEstimate {
  const status = (["draft", "ready", "accepted", "declined", "expired"] as const).includes(
    row.status as WorkspaceEstimateStatus,
  )
    ? (row.status as WorkspaceEstimateStatus)
    : "draft";
  return {
    id: String(row.id),
    estimateNumber: String(row.estimate_number),
    status,
    title: String(row.title || ""),
    description: String(row.description || ""),
    clientId: (row.client_id as string | null) ?? null,
    issueDate: row.issue_date ? String(row.issue_date) : null,
    expiresOn: row.expires_on ? String(row.expires_on) : null,
    currency: String(row.currency || "USD"),
    internalNotes: String(row.internal_notes || ""),
    customerNotes: String(row.customer_notes || ""),
    terms: String(row.terms || ""),
    orgLegalName: String(row.org_legal_name || ""),
    orgDisplayName: String(row.org_display_name || ""),
    clientBusinessName: String(row.client_business_name || ""),
    clientContactName: String(row.client_contact_name || ""),
    clientEmail: String(row.client_email || ""),
    subtotalCents: Number(row.subtotal_cents || 0),
    discountCents: Number(row.discount_cents || 0),
    taxCents: Number(row.tax_cents || 0),
    totalCents: Number(row.total_cents || 0),
    lines,
    readyAt: row.ready_at ? String(row.ready_at) : null,
    acceptedAt: row.accepted_at ? String(row.accepted_at) : null,
    declinedAt: row.declined_at ? String(row.declined_at) : null,
    expiredAt: row.expired_at ? String(row.expired_at) : null,
    archived: Boolean(row.archived_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listWorkspaceEstimates(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from("ws_estimates")
    .select("*")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });
  if (error) return { error: true as const };
  const estimates = (data ?? []).map((row) => mapEstimateRow(row as Record<string, unknown>));
  if (!estimates.length) return estimates;
  const { data: lines, error: lineError } = await supabase
    .from("ws_estimate_lines")
    .select("*")
    .eq("organization_id", organizationId)
    .in(
      "estimate_id",
      estimates.map((item) => item.id),
    )
    .order("position", { ascending: true });
  if (lineError) return { error: true as const };
  const grouped = new Map<string, WorkspaceEstimateLine[]>();
  for (const row of lines ?? []) {
    const mapped = mapEstimateLineRow(row as Record<string, unknown>);
    const list = grouped.get(String((row as { estimate_id: string }).estimate_id)) ?? [];
    list.push(mapped);
    grouped.set(String((row as { estimate_id: string }).estimate_id), list);
  }
  return estimates.map((estimate) => ({ ...estimate, lines: grouped.get(estimate.id) ?? [] }));
}

async function rpcId(supabase: SupabaseClient, name: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, args);
  if (error || !data) return { error: true as const };
  return { id: String(data) };
}

export async function saveWorkspaceEstimate(
  supabase: SupabaseClient,
  organizationId: string,
  input: {
    id?: string;
    clientId: string | null;
    title: string;
    description: string;
    issueDate: string | null;
    expiresOn: string | null;
    currency: string;
    internalNotes: string;
    customerNotes: string;
    terms: string;
    clientBusinessName: string;
    clientContactName: string;
    clientEmail: string;
    taxCents: number;
    lines: Array<{ description: string; quantity: number; unitCents: number; discountCents: number }>;
  },
) {
  return rpcId(supabase, ESTIMATE_SAVE_RPC, {
    p_organization_id: organizationId,
    p_id: optionalUuid(input.id),
    p_client_id: optionalUuid(input.clientId),
    p_title: sanitizeText(input.title).slice(0, 160),
    p_description: sanitizeText(input.description).slice(0, 4000),
    p_issue_date: input.issueDate,
    p_expires_on: input.expiresOn,
    p_currency: input.currency || "USD",
    p_internal_notes: sanitizeText(input.internalNotes).slice(0, 4000),
    p_customer_notes: sanitizeText(input.customerNotes).slice(0, 4000),
    p_terms: sanitizeText(input.terms).slice(0, 4000),
    p_client_business_name: sanitizeText(input.clientBusinessName).slice(0, 160),
    p_client_contact_name: sanitizeText(input.clientContactName).slice(0, 160),
    p_client_email: sanitizeText(input.clientEmail).slice(0, 254),
    p_tax_cents: Math.max(0, Math.trunc(input.taxCents)),
    p_lines: estimateLinesPayload(input.lines),
  });
}

export async function setWorkspaceEstimateStatus(
  supabase: SupabaseClient,
  organizationId: string,
  id: string,
  status: WorkspaceEstimateStatus,
) {
  return rpcId(supabase, ESTIMATE_STATUS_RPC, {
    p_organization_id: organizationId,
    p_id: id,
    p_status: status,
  });
}

export async function archiveWorkspaceEstimate(supabase: SupabaseClient, organizationId: string, id: string) {
  return rpcId(supabase, ESTIMATE_ARCHIVE_RPC, { p_organization_id: organizationId, p_id: id });
}

export async function restoreWorkspaceEstimate(supabase: SupabaseClient, organizationId: string, id: string) {
  return rpcId(supabase, ESTIMATE_RESTORE_RPC, { p_organization_id: organizationId, p_id: id });
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/config";
import { dollarsToCents, centsToDollars } from "@/lib/money";
import { LEAD_STAGES, type ClientRecord, type Lead, type LeadStage } from "@/lib/types";
import { sanitizeText } from "@/lib/validation";
import type { SessionUser } from "@/lib/auth/session";

export const CRM_CLIENT_SAVE_RPC = "sts_save_crm_client";
export const CRM_LEAD_SAVE_RPC = "sts_save_crm_lead";
export const GENERIC_CRM_ERROR = "The record could not be saved.";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPersistedCrmId(value: string | null | undefined): value is string {
  return Boolean(value && UUID_RE.test(value));
}

export function isLeadStage(value: string | null | undefined): value is LeadStage {
  return Boolean(value && (LEAD_STAGES as readonly string[]).includes(value));
}

type ClientRow = {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  industry: string;
  status: string;
  notes: string;
};

type LeadRow = {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  source: string;
  requested_service: string;
  estimated_value_cents: number;
  probability: number;
  stage: string;
  last_contact: string | null;
  next_follow_up: string | null;
  calls_made: number;
  emails_sent: number;
  meetings: number;
  notes: string;
  assigned_to: string;
  created_at: string;
};

export function mapCrmClientRow(row: ClientRow): ClientRecord {
  const status = row.status === "paused" || row.status === "archived" ? row.status : "active";
  return {
    id: row.id,
    businessName: row.business_name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    industry: row.industry,
    status,
    portalEnabled: false,
    notes: row.notes,
  };
}

export function mapCrmLeadRow(row: LeadRow): Lead {
  return {
    id: row.id,
    businessName: row.business_name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    source: row.source,
    requestedService: row.requested_service,
    estimatedValue: centsToDollars(row.estimated_value_cents),
    probability: row.probability,
    stage: isLeadStage(row.stage) ? row.stage : "new_inquiry",
    lastContact: row.last_contact,
    nextFollowUp: row.next_follow_up,
    callsMade: row.calls_made,
    emailsSent: row.emails_sent,
    meetings: row.meetings,
    notes: row.notes,
    assignedTo: row.assigned_to,
    createdAt: row.created_at.slice(0, 10),
  };
}

export function shouldUseCrmDatabase(user: SessionUser | null | undefined) {
  return Boolean(
    user?.source === "supabase" &&
      isSupabaseConfigured() &&
      user.organizationId &&
      user.membershipStatus === "active",
  );
}

export async function listCrmClientsFromDatabase(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<ClientRecord[] | { error: true }> {
  try {
    const { data, error } = await supabase
      .from("crm_clients")
      .select("id, business_name, contact_name, email, phone, industry, status, notes")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false });
    if (error) return { error: true };
    return ((data ?? []) as ClientRow[]).map(mapCrmClientRow);
  } catch {
    return { error: true };
  }
}

export async function listCrmLeadsFromDatabase(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<Lead[] | { error: true }> {
  try {
    const { data, error } = await supabase
      .from("crm_leads")
      .select(
        "id, business_name, contact_name, email, phone, source, requested_service, estimated_value_cents, probability, stage, last_contact, next_follow_up, calls_made, emails_sent, meetings, notes, assigned_to, created_at",
      )
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false });
    if (error) return { error: true };
    return ((data ?? []) as LeadRow[]).map(mapCrmLeadRow);
  } catch {
    return { error: true };
  }
}

export async function loadCrmClientFromDatabase(
  supabase: SupabaseClient,
  organizationId: string,
  id: string,
): Promise<ClientRecord | null> {
  if (!isPersistedCrmId(id)) return null;
  const { data, error } = await supabase
    .from("crm_clients")
    .select("id, business_name, contact_name, email, phone, industry, status, notes")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapCrmClientRow(data as ClientRow);
}

export async function loadCrmLeadFromDatabase(
  supabase: SupabaseClient,
  organizationId: string,
  id: string,
): Promise<Lead | null> {
  if (!isPersistedCrmId(id)) return null;
  const { data, error } = await supabase
    .from("crm_leads")
    .select(
      "id, business_name, contact_name, email, phone, source, requested_service, estimated_value_cents, probability, stage, last_contact, next_follow_up, calls_made, emails_sent, meetings, notes, assigned_to, created_at",
    )
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapCrmLeadRow(data as LeadRow);
}

export function normalizeClientInput(input: Partial<ClientRecord> & { id?: string }): ClientRecord {
  const status = input.status === "paused" || input.status === "archived" ? input.status : "active";
  return {
    id: input.id || "",
    businessName: sanitizeText(input.businessName || "New client"),
    contactName: sanitizeText(input.contactName || ""),
    email: String(input.email || "").trim(),
    phone: sanitizeText(input.phone || ""),
    industry: sanitizeText(input.industry || ""),
    status,
    portalEnabled: false,
    notes: sanitizeText(input.notes || ""),
  };
}

export function normalizeLeadInput(input: Partial<Lead> & { id?: string }, current?: Lead | null): Lead {
  const merged = { ...(current ?? {}), ...input };
  return {
    id: merged.id || "",
    businessName: sanitizeText(merged.businessName || "New inquiry"),
    contactName: sanitizeText(merged.contactName || ""),
    email: String(merged.email || "").trim(),
    phone: sanitizeText(merged.phone || ""),
    source: sanitizeText(merged.source || "Manual") || "Manual",
    requestedService: sanitizeText(merged.requestedService || ""),
    estimatedValue: Number(merged.estimatedValue || 0),
    probability: Number(merged.probability ?? 10),
    stage: isLeadStage(merged.stage) ? merged.stage : "new_inquiry",
    lastContact: merged.lastContact ?? null,
    nextFollowUp: merged.nextFollowUp ?? null,
    callsMade: Number(merged.callsMade || 0),
    emailsSent: Number(merged.emailsSent || 0),
    meetings: Number(merged.meetings || 0),
    notes: sanitizeText(merged.notes || ""),
    assignedTo: sanitizeText(merged.assignedTo || "Owner") || "Owner",
    createdAt: merged.createdAt || new Date().toISOString().slice(0, 10),
  };
}

export async function saveCrmClientInDatabase(
  supabase: SupabaseClient,
  organizationId: string,
  input: ClientRecord,
): Promise<{ id: string } | { error: true }> {
  try {
    const { data, error } = await supabase.rpc(CRM_CLIENT_SAVE_RPC, {
      p_organization_id: organizationId,
      p_id: isPersistedCrmId(input.id) ? input.id : null,
      p_business_name: input.businessName,
      p_contact_name: input.contactName,
      p_email: input.email,
      p_phone: input.phone,
      p_industry: input.industry,
      p_status: input.status,
      p_notes: input.notes,
    });
    if (error || !data) return { error: true };
    return { id: String(data) };
  } catch {
    return { error: true };
  }
}

export async function saveCrmLeadInDatabase(
  supabase: SupabaseClient,
  organizationId: string,
  input: Lead,
): Promise<{ id: string } | { error: true }> {
  try {
    const { data, error } = await supabase.rpc(CRM_LEAD_SAVE_RPC, {
      p_organization_id: organizationId,
      p_id: isPersistedCrmId(input.id) ? input.id : null,
      p_business_name: input.businessName,
      p_contact_name: input.contactName,
      p_email: input.email,
      p_phone: input.phone,
      p_source: input.source,
      p_requested_service: input.requestedService,
      p_estimated_value_cents: Math.max(0, dollarsToCents(input.estimatedValue)),
      p_probability: Math.min(100, Math.max(0, Math.round(input.probability))),
      p_stage: input.stage,
      p_last_contact: input.lastContact,
      p_next_follow_up: input.nextFollowUp,
      p_calls_made: Math.max(0, Math.round(input.callsMade)),
      p_emails_sent: Math.max(0, Math.round(input.emailsSent)),
      p_meetings: Math.max(0, Math.round(input.meetings)),
      p_notes: input.notes,
      p_assigned_to: input.assignedTo,
    });
    if (error || !data) return { error: true };
    return { id: String(data) };
  } catch {
    return { error: true };
  }
}

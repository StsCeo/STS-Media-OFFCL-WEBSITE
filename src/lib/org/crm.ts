import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/config";
import { dollarsToCents, centsToDollars } from "@/lib/money";
import { LEAD_STAGES, type ClientRecord, type IcpRecord, type Lead, type LeadStage } from "@/lib/types";
import { sanitizeText } from "@/lib/validation";
import type { SessionUser } from "@/lib/auth/session";

export const CRM_CLIENT_SAVE_RPC = "sts_save_crm_client";
export const CRM_LEAD_SAVE_RPC = "sts_save_crm_lead";
export const CRM_ICP_SAVE_RPC = "sts_save_crm_icp";
export const CRM_LEAD_CONVERT_RPC = "sts_convert_crm_lead_to_client";
export const GENERIC_CRM_ERROR = "The record could not be saved.";
export const GENERIC_CONVERT_ERROR = "The lead could not be converted.";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LEAD_SELECT =
  "id, business_name, contact_name, email, phone, source, requested_service, estimated_value_cents, probability, stage, last_contact, next_follow_up, calls_made, emails_sent, meetings, notes, assigned_to, created_at, icp_id, converted_client_id, estimate_id, lost_reason, expected_close_on, assigned_member_id";

const CLIENT_SELECT = "id, business_name, contact_name, email, phone, industry, status, notes";

const ICP_SELECT =
  "id, name, industry, company_size, market, estimated_budget_min_cents, estimated_budget_max_cents, common_problems, services_needed, decision_maker, acquisition_channels, common_objections, buying_triggers, notes, status, created_at, updated_at";

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
  icp_id?: string | null;
  converted_client_id?: string | null;
  estimate_id?: string | null;
  lost_reason?: string | null;
  expected_close_on?: string | null;
  assigned_member_id?: string | null;
};

type IcpRow = {
  id: string;
  name: string;
  industry: string;
  company_size: string;
  market: string;
  estimated_budget_min_cents: number;
  estimated_budget_max_cents: number;
  common_problems: string;
  services_needed: string;
  decision_maker: string;
  acquisition_channels: string;
  common_objections: string;
  buying_triggers: string;
  notes: string;
  status: string;
  created_at: string;
  updated_at: string;
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
    icpId: row.icp_id ?? null,
    convertedClientId: row.converted_client_id ?? null,
    estimateId: row.estimate_id ?? null,
    lostReason: row.lost_reason ?? null,
    expectedCloseOn: row.expected_close_on ?? null,
    assignedMemberId: row.assigned_member_id ?? null,
  };
}

export function mapCrmIcpRow(row: IcpRow): IcpRecord {
  return {
    id: row.id,
    name: row.name,
    industry: row.industry,
    companySize: row.company_size,
    market: row.market,
    estimatedBudgetMin: centsToDollars(row.estimated_budget_min_cents),
    estimatedBudgetMax: centsToDollars(row.estimated_budget_max_cents),
    commonProblems: row.common_problems,
    servicesNeeded: row.services_needed,
    decisionMaker: row.decision_maker,
    acquisitionChannels: row.acquisition_channels,
    commonObjections: row.common_objections,
    buyingTriggers: row.buying_triggers,
    notes: row.notes,
    status: row.status === "archived" ? "archived" : "active",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function shouldUseCrmDatabase(user: SessionUser | null | undefined) {
  return Boolean(
    user?.source === "supabase" &&
      isSupabaseConfigured() &&
      user.organizationId &&
      user.membershipStatus === "active" &&
      user.mfaVerified,
  );
}

export async function listCrmClientsFromDatabase(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<ClientRecord[] | { error: true }> {
  try {
    const { data, error } = await supabase
      .from("crm_clients")
      .select(CLIENT_SELECT)
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
      .select(LEAD_SELECT)
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false });
    if (error) return { error: true };
    return ((data ?? []) as LeadRow[]).map(mapCrmLeadRow);
  } catch {
    return { error: true };
  }
}

export async function listCrmIcpsFromDatabase(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<IcpRecord[] | { error: true }> {
  try {
    const { data, error } = await supabase
      .from("crm_icps")
      .select(ICP_SELECT)
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false });
    if (error) return { error: true };
    return ((data ?? []) as IcpRow[]).map(mapCrmIcpRow);
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
    .select(CLIENT_SELECT)
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
    .select(LEAD_SELECT)
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
    icpId: merged.icpId ?? null,
    convertedClientId: merged.convertedClientId ?? null,
    estimateId: merged.estimateId ?? null,
    lostReason: merged.lostReason ?? null,
    expectedCloseOn: merged.expectedCloseOn ?? null,
    assignedMemberId: merged.assignedMemberId ?? null,
  };
}

export function normalizeIcpInput(input: Partial<IcpRecord> & { id?: string }, current?: IcpRecord | null): IcpRecord {
  const merged = { ...(current ?? {}), ...input };
  const min = Math.max(0, Number(merged.estimatedBudgetMin || 0));
  const max = Math.max(min, Number(merged.estimatedBudgetMax || 0));
  return {
    id: merged.id || "",
    name: sanitizeText(merged.name || "New ICP"),
    industry: sanitizeText(merged.industry || ""),
    companySize: sanitizeText(merged.companySize || ""),
    market: sanitizeText(merged.market || ""),
    estimatedBudgetMin: min,
    estimatedBudgetMax: max,
    commonProblems: sanitizeText(merged.commonProblems || ""),
    servicesNeeded: sanitizeText(merged.servicesNeeded || ""),
    decisionMaker: sanitizeText(merged.decisionMaker || ""),
    acquisitionChannels: sanitizeText(merged.acquisitionChannels || ""),
    commonObjections: sanitizeText(merged.commonObjections || ""),
    buyingTriggers: sanitizeText(merged.buyingTriggers || ""),
    notes: sanitizeText(merged.notes || ""),
    status: merged.status === "archived" ? "archived" : "active",
    createdAt: merged.createdAt || new Date().toISOString(),
    updatedAt: merged.updatedAt || new Date().toISOString(),
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
      p_icp_id: isPersistedCrmId(input.icpId) ? input.icpId : null,
      p_estimate_id: isPersistedCrmId(input.estimateId) ? input.estimateId : null,
      p_lost_reason: input.lostReason || null,
      p_expected_close_on: input.expectedCloseOn || null,
      p_assigned_member_id: isPersistedCrmId(input.assignedMemberId) ? input.assignedMemberId : null,
    });
    if (error || !data) return { error: true };
    return { id: String(data) };
  } catch {
    return { error: true };
  }
}

export async function saveCrmIcpInDatabase(
  supabase: SupabaseClient,
  organizationId: string,
  input: IcpRecord,
): Promise<{ id: string } | { error: true }> {
  try {
    const { data, error } = await supabase.rpc(CRM_ICP_SAVE_RPC, {
      p_organization_id: organizationId,
      p_id: isPersistedCrmId(input.id) ? input.id : null,
      p_name: input.name,
      p_industry: input.industry,
      p_company_size: input.companySize,
      p_market: input.market,
      p_estimated_budget_min_cents: Math.max(0, dollarsToCents(input.estimatedBudgetMin)),
      p_estimated_budget_max_cents: Math.max(0, dollarsToCents(input.estimatedBudgetMax)),
      p_common_problems: input.commonProblems,
      p_services_needed: input.servicesNeeded,
      p_decision_maker: input.decisionMaker,
      p_acquisition_channels: input.acquisitionChannels,
      p_common_objections: input.commonObjections,
      p_buying_triggers: input.buyingTriggers,
      p_notes: input.notes,
      p_status: input.status,
    });
    if (error || !data) return { error: true };
    return { id: String(data) };
  } catch {
    return { error: true };
  }
}

export async function convertCrmLeadInDatabase(
  supabase: SupabaseClient,
  organizationId: string,
  leadId: string,
): Promise<{ id: string } | { error: true }> {
  if (!isPersistedCrmId(leadId)) return { error: true };
  try {
    const { data, error } = await supabase.rpc(CRM_LEAD_CONVERT_RPC, {
      p_organization_id: organizationId,
      p_lead_id: leadId,
    });
    if (error || !data) return { error: true };
    return { id: String(data) };
  } catch {
    return { error: true };
  }
}

export function convertLeadInMemory(
  leads: Lead[],
  clients: ClientRecord[],
  leadId: string,
): { leads: Lead[]; clients: ClientRecord[]; clientId: string } | { error: true } {
  const lead = leads.find((item) => item.id === leadId);
  if (!lead) return { error: true };
  if (lead.convertedClientId) {
    return { leads, clients, clientId: lead.convertedClientId };
  }
  const email = lead.email.trim().toLowerCase();
  const existing =
    (email
      ? clients.find((client) => client.email.trim().toLowerCase() === email)
      : undefined) ??
    clients.find((client) => client.businessName.trim().toLowerCase() === lead.businessName.trim().toLowerCase());
  const clientId = existing?.id ?? `client-${lead.id}`;
  const nextClients = existing
    ? clients
    : [
        {
          id: clientId,
          businessName: lead.businessName,
          contactName: lead.contactName,
          email: lead.email,
          phone: lead.phone,
          industry: "",
          status: "active" as const,
          portalEnabled: false,
          notes: lead.notes || "Converted from lead.",
        },
        ...clients,
      ];
  return {
    clients: nextClients,
    clientId,
    leads: leads.map((item) => (item.id === leadId ? { ...item, convertedClientId: clientId } : item)),
  };
}

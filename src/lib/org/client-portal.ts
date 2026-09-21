import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canAccessClientPortal,
  canAccessDashboard,
  createSupabaseServer,
  getSession,
} from "@/lib/auth/session";
import {
  attachLines,
  CLIENT_PORTAL_MAPPING_NOTE,
  CLIENT_PORTAL_PUBLISH_NOTE,
  CLIENT_PORTAL_RECORD_NOTE,
  CLIENT_PORTAL_READONLY_NOTE,
  isClientPortalSourceType,
  mapClientPortalCandidate,
  mapClientPortalDocument,
  mapClientPortalEstimate,
  mapClientPortalEstimateLine,
  mapClientPortalIdentity,
  mapClientPortalInvoice,
  mapClientPortalInvoiceLine,
  mapClientPortalProfile,
  mapClientPortalProject,
  mapClientPortalPublication,
  mapClientPortalVisibility,
  publicationKey,
  type ClientPortalCandidate,
  type ClientPortalDocument,
  type ClientPortalEstimate,
  type ClientPortalIdentity,
  type ClientPortalInvoice,
  type ClientPortalProfile,
  type ClientPortalProject,
  type ClientPortalPublication,
  type ClientPortalSourceType,
  type ClientPortalVisibility,
} from "@/lib/org/client-portal-model";

export const CLIENT_PORTAL_PROFILE_RPC = "sts_client_portal_profile";
export const CLIENT_PORTAL_ESTIMATES_RPC = "sts_list_client_portal_estimates";
export const CLIENT_PORTAL_ESTIMATE_GET_RPC = "sts_get_client_portal_estimate";
export const CLIENT_PORTAL_ESTIMATE_LINES_RPC = "sts_list_client_portal_estimate_lines";
export const CLIENT_PORTAL_INVOICES_RPC = "sts_list_client_portal_invoices";
export const CLIENT_PORTAL_INVOICE_GET_RPC = "sts_get_client_portal_invoice";
export const CLIENT_PORTAL_INVOICE_LINES_RPC = "sts_list_client_portal_invoice_lines";
export const CLIENT_PORTAL_PROJECTS_RPC = "sts_list_client_portal_projects";
export const CLIENT_PORTAL_PROJECT_GET_RPC = "sts_get_client_portal_project";
export const CLIENT_PORTAL_DOCUMENTS_RPC = "sts_list_client_portal_documents";
export const CLIENT_PORTAL_AUTHORIZE_DOCUMENT_RPC = "sts_client_portal_authorize_document";
export const CLIENT_PORTAL_DOCUMENT_OBJECT_RPC = "sts_client_portal_document_object_name";
export const CLIENT_PORTAL_IDENTITIES_RPC = "sts_list_client_portal_identities";
export const CLIENT_PORTAL_CANDIDATES_RPC = "sts_list_client_portal_candidate_members";
export const CLIENT_PORTAL_LINK_RPC = "sts_link_client_portal_identity";
export const CLIENT_PORTAL_DISABLE_RPC = "sts_disable_client_portal_identity";
export const CLIENT_PORTAL_PUBLICATIONS_RPC = "sts_list_client_portal_publications";
export const CLIENT_PORTAL_VISIBILITY_RPC = "sts_client_portal_record_visibility";
export const CLIENT_PORTAL_PUBLISH_RPC = "sts_publish_client_portal_record";
export const CLIENT_PORTAL_UNPUBLISH_RPC = "sts_unpublish_client_portal_record";

async function rpcRows(supabase: SupabaseClient, name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) return { error: true as const };
  return ((data ?? []) as Record<string, unknown>[]);
}

export async function loadClientPortalHome(): Promise<{
  profile: ClientPortalProfile | null;
  estimates: ClientPortalEstimate[];
  invoices: ClientPortalInvoice[];
  projects: ClientPortalProject[];
  documents: ClientPortalDocument[];
  mapped: boolean;
  unavailable: boolean;
  recordNote: string;
  readonlyNote: string;
}> {
  const notes = {
    recordNote: CLIENT_PORTAL_RECORD_NOTE,
    readonlyNote: CLIENT_PORTAL_READONLY_NOTE,
  };
  const empty = {
    profile: null,
    estimates: [] as ClientPortalEstimate[],
    invoices: [] as ClientPortalInvoice[],
    projects: [] as ClientPortalProject[],
    documents: [] as ClientPortalDocument[],
    mapped: false,
    unavailable: true,
    ...notes,
  };
  const session = await getSession();
  if (!canAccessClientPortal(session.user)) return empty;
  const factory = createSupabaseServer();
  if (!factory) return empty;
  const supabase = await factory();
  const [profileRows, estimates, estimateLines, invoices, invoiceLines, projects, documents] = await Promise.all([
    rpcRows(supabase, CLIENT_PORTAL_PROFILE_RPC),
    rpcRows(supabase, CLIENT_PORTAL_ESTIMATES_RPC),
    rpcRows(supabase, CLIENT_PORTAL_ESTIMATE_LINES_RPC),
    rpcRows(supabase, CLIENT_PORTAL_INVOICES_RPC),
    rpcRows(supabase, CLIENT_PORTAL_INVOICE_LINES_RPC),
    rpcRows(supabase, CLIENT_PORTAL_PROJECTS_RPC),
    rpcRows(supabase, CLIENT_PORTAL_DOCUMENTS_RPC),
  ]);
  if ("error" in profileRows) {
    return { ...empty, mapped: false, unavailable: false };
  }
  const profile = profileRows[0] ? mapClientPortalProfile(profileRows[0]) : null;
  if (!profile) {
    return { ...empty, mapped: false, unavailable: false };
  }
  if (
    "error" in estimates ||
    "error" in estimateLines ||
    "error" in invoices ||
    "error" in invoiceLines ||
    "error" in projects ||
    "error" in documents
  ) {
    return { ...empty, profile, mapped: true, unavailable: true };
  }
  const estimateLineRows = estimateLines.map(mapClientPortalEstimateLine);
  const invoiceLineRows = invoiceLines.map(mapClientPortalInvoiceLine);
  return {
    profile,
    estimates: attachLines(
      estimates.map((row) => mapClientPortalEstimate(row)),
      estimateLineRows,
      (record, lines) => ({ ...record, lines }),
    ),
    invoices: attachLines(
      invoices.map((row) => mapClientPortalInvoice(row)),
      invoiceLineRows,
      (record, lines) => ({ ...record, lines }),
    ),
    projects: projects.map(mapClientPortalProject),
    documents: documents.map(mapClientPortalDocument),
    mapped: true,
    unavailable: false,
    ...notes,
  };
}

export async function loadClientPortalEstimate(id: string) {
  const home = await loadClientPortalHome();
  return {
    ...home,
    estimate: home.estimates.find((item) => item.id === id) ?? null,
  };
}

export async function loadClientPortalInvoice(id: string) {
  const home = await loadClientPortalHome();
  return {
    ...home,
    invoice: home.invoices.find((item) => item.id === id) ?? null,
  };
}

export async function loadClientPortalProject(id: string) {
  const home = await loadClientPortalHome();
  return {
    ...home,
    project: home.projects.find((item) => item.id === id) ?? null,
  };
}

export async function loadClientPortalOwnerIndex(): Promise<{
  identities: ClientPortalIdentity[];
  candidates: ClientPortalCandidate[];
  publications: ClientPortalPublication[];
  visibilityByKey: Record<string, ClientPortalVisibility>;
  unavailable: boolean;
  mappingNote: string;
  publishNote: string;
}> {
  const notes = {
    mappingNote: CLIENT_PORTAL_MAPPING_NOTE,
    publishNote: CLIENT_PORTAL_PUBLISH_NOTE,
  };
  const empty = {
    identities: [] as ClientPortalIdentity[],
    candidates: [] as ClientPortalCandidate[],
    publications: [] as ClientPortalPublication[],
    visibilityByKey: {} as Record<string, ClientPortalVisibility>,
    unavailable: true,
    ...notes,
  };
  const session = await getSession();
  if (!canAccessDashboard(session.user)) return empty;
  const factory = createSupabaseServer();
  if (!factory) return empty;
  const supabase = await factory();
  const [identities, candidates, publications] = await Promise.all([
    rpcRows(supabase, CLIENT_PORTAL_IDENTITIES_RPC),
    rpcRows(supabase, CLIENT_PORTAL_CANDIDATES_RPC),
    rpcRows(supabase, CLIENT_PORTAL_PUBLICATIONS_RPC),
  ]);
  if ("error" in identities || "error" in candidates || "error" in publications) {
    return empty;
  }
  const publicationRows = publications
    .map(mapClientPortalPublication)
    .filter((row): row is ClientPortalPublication => Boolean(row));
  const visibilityByKey: Record<string, ClientPortalVisibility> = {};
  for (const row of publicationRows) {
    visibilityByKey[publicationKey(row.sourceType, row.sourceId)] = {
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      published: row.published,
      mappingActive: identities.some(
        (identity) => identity.crmClientId === row.crmClientId && identity.status === "active",
      ),
      archived: false,
      clientBusinessName: row.clientBusinessName,
      canPublish: identities.some(
        (identity) => identity.crmClientId === row.crmClientId && identity.status === "active",
      ),
    };
  }
  return {
    identities: identities.map(mapClientPortalIdentity),
    candidates: candidates.map(mapClientPortalCandidate),
    publications: publicationRows,
    visibilityByKey,
    unavailable: false,
    ...notes,
  };
}

export function visibilityFor(
  index: Awaited<ReturnType<typeof loadClientPortalOwnerIndex>>,
  sourceType: ClientPortalSourceType,
  sourceId: string,
  clientId: string | null | undefined,
  clientBusinessName: string,
  archived: boolean,
): ClientPortalVisibility {
  const existing = index.visibilityByKey[publicationKey(sourceType, sourceId)];
  const mappingActive = Boolean(
    clientId && index.identities.some((identity) => identity.crmClientId === clientId && identity.status === "active"),
  );
  if (existing) {
    return {
      ...existing,
      mappingActive,
      archived,
      clientBusinessName: existing.clientBusinessName || clientBusinessName,
      canPublish: !archived && mappingActive,
    };
  }
  return {
    sourceType,
    sourceId,
    published: false,
    mappingActive,
    archived,
    clientBusinessName,
    canPublish: !archived && mappingActive && Boolean(clientId),
  };
}

export async function publishClientPortalRecord(
  supabase: SupabaseClient,
  sourceType: ClientPortalSourceType,
  sourceId: string,
) {
  if (!isClientPortalSourceType(sourceType)) return { error: true as const };
  const { error } = await supabase.rpc(CLIENT_PORTAL_PUBLISH_RPC, {
    p_source_type: sourceType,
    p_source_id: sourceId,
  });
  return error ? { error: true as const } : { ok: true as const };
}

export async function unpublishClientPortalRecord(
  supabase: SupabaseClient,
  sourceType: ClientPortalSourceType,
  sourceId: string,
) {
  if (!isClientPortalSourceType(sourceType)) return { error: true as const };
  const { error } = await supabase.rpc(CLIENT_PORTAL_UNPUBLISH_RPC, {
    p_source_type: sourceType,
    p_source_id: sourceId,
  });
  return error ? { error: true as const } : { ok: true as const };
}

export async function linkClientPortalIdentity(supabase: SupabaseClient, userId: string, crmClientId: string) {
  const { error } = await supabase.rpc(CLIENT_PORTAL_LINK_RPC, {
    p_user_id: userId,
    p_crm_client_id: crmClientId,
  });
  return error ? { error: true as const } : { ok: true as const };
}

export async function disableClientPortalIdentity(supabase: SupabaseClient, identityId: string) {
  const { error } = await supabase.rpc(CLIENT_PORTAL_DISABLE_RPC, { p_id: identityId });
  return error ? { error: true as const } : { ok: true as const };
}

export async function authorizeClientPortalDocument(supabase: SupabaseClient, documentId: string) {
  const rows = await rpcRows(supabase, CLIENT_PORTAL_AUTHORIZE_DOCUMENT_RPC, { p_id: documentId });
  if ("error" in rows || !rows[0]) return { error: true as const };
  return {
    id: String(rows[0].id || ""),
    title: String(rows[0].title || "document"),
    contentType: String(rows[0].content_type || "application/octet-stream"),
    byteSize: Number(rows[0].byte_size || 0),
  };
}

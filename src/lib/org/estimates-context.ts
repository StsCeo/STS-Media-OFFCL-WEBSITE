import { createSupabaseServer, getSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/data/store";
import { listCrmClientsFromDatabase, shouldUseCrmDatabase } from "@/lib/org/crm";
import {
  ESTIMATE_RECORD_NOTE,
  estimateSummaries,
  listWorkspaceEstimates,
  shouldUseEstimateDatabase,
} from "@/lib/org/estimates";
import { listWorkspaceInvoices, shouldUseWorkspaceDatabase } from "@/lib/org/workspace";
import type { ClientRecord, WorkspaceEstimate } from "@/lib/types";

function conversionMap(invoices: Array<{ id: string; sourceEstimateId?: string | null }>) {
  const mapped: Record<string, string> = {};
  for (const invoice of invoices) {
    if (invoice.sourceEstimateId) mapped[invoice.sourceEstimateId] = invoice.id;
  }
  return mapped;
}

export async function loadVisibleEstimates(): Promise<{
  estimates: WorkspaceEstimate[];
  clients: ClientRecord[];
  convertedInvoiceIds: Record<string, string>;
  source: "postgres" | "demo-memory";
  unavailable: boolean;
  recordNote: string;
  summaries: ReturnType<typeof estimateSummaries>;
}> {
  const session = await getSession();
  const workspace = getWorkspace();
  if (session.user?.source === "supabase" && !session.user.mfaVerified) {
    return emptyEstimates("postgres", true);
  }
  if (!shouldUseEstimateDatabase(session.user) || !session.user?.organizationId) {
    return {
      estimates: workspace.workspaceEstimates,
      clients: workspace.clients,
      convertedInvoiceIds: conversionMap(workspace.workspaceInvoices),
      source: "demo-memory",
      unavailable: false,
      recordNote: ESTIMATE_RECORD_NOTE,
      summaries: estimateSummaries(workspace.workspaceEstimates),
    };
  }

  const factory = createSupabaseServer();
  if (!factory) return emptyEstimates("postgres", true);
  const supabase = await factory();
  const organizationId = session.user.organizationId;
  const [estimates, clients, invoices] = await Promise.all([
    listWorkspaceEstimates(supabase, organizationId),
    shouldUseCrmDatabase(session.user)
      ? listCrmClientsFromDatabase(supabase, organizationId)
      : Promise.resolve(workspace.clients),
    shouldUseWorkspaceDatabase(session.user)
      ? listWorkspaceInvoices(supabase, organizationId)
      : Promise.resolve(workspace.workspaceInvoices),
  ]);
  if ("error" in estimates || "error" in clients || "error" in invoices) {
    return emptyEstimates("postgres", true);
  }
  return {
    estimates,
    clients,
    convertedInvoiceIds: conversionMap(invoices),
    source: "postgres",
    unavailable: false,
    recordNote: ESTIMATE_RECORD_NOTE,
    summaries: estimateSummaries(estimates),
  };
}

function emptyEstimates(source: "postgres" | "demo-memory", unavailable: boolean) {
  return {
    estimates: [] as WorkspaceEstimate[],
    clients: [] as ClientRecord[],
    convertedInvoiceIds: {} as Record<string, string>,
    source,
    unavailable,
    recordNote: ESTIMATE_RECORD_NOTE,
    summaries: estimateSummaries([]),
  };
}

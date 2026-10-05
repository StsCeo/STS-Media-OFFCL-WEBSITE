import { createSupabaseServer, getSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/data/store";
import {
  listCrmClientsFromDatabase,
  listCrmIcpsFromDatabase,
  listCrmLeadsFromDatabase,
  shouldUseCrmDatabase,
} from "@/lib/org/crm";
import type { ClientRecord, IcpRecord, Lead } from "@/lib/types";

export async function loadVisibleCrmRecords(): Promise<{
  clients: ClientRecord[];
  leads: Lead[];
  icps: IcpRecord[];
  source: "postgres" | "demo-memory";
  unavailable: boolean;
}> {
  const session = await getSession();
  if (session.user?.source === "supabase" && !session.user.mfaVerified) {
    return { clients: [], leads: [], icps: [], source: "postgres", unavailable: true };
  }
  if (shouldUseCrmDatabase(session.user) && session.user?.organizationId) {
    const factory = createSupabaseServer();
    if (!factory) {
      return { clients: [], leads: [], icps: [], source: "postgres", unavailable: true };
    }
    const supabase = await factory();
    const [clients, leads, icps] = await Promise.all([
      listCrmClientsFromDatabase(supabase, session.user.organizationId),
      listCrmLeadsFromDatabase(supabase, session.user.organizationId),
      listCrmIcpsFromDatabase(supabase, session.user.organizationId),
    ]);
    if ("error" in clients || "error" in leads || "error" in icps) {
      return { clients: [], leads: [], icps: [], source: "postgres", unavailable: true };
    }
    return { clients, leads, icps, source: "postgres", unavailable: false };
  }
  const workspace = getWorkspace();
  return {
    clients: workspace.clients,
    leads: workspace.leads,
    icps: workspace.icps ?? [],
    source: "demo-memory",
    unavailable: false,
  };
}

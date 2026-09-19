import { createSupabaseServer, getSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/data/store";
import {
  listCrmClientsFromDatabase,
  listCrmLeadsFromDatabase,
  shouldUseCrmDatabase,
} from "@/lib/org/crm";
import type { ClientRecord, Lead } from "@/lib/types";

export async function loadVisibleCrmRecords(): Promise<{
  clients: ClientRecord[];
  leads: Lead[];
  source: "postgres" | "demo-memory";
  unavailable: boolean;
}> {
  const session = await getSession();
  if (shouldUseCrmDatabase(session.user) && session.user?.organizationId) {
    const factory = createSupabaseServer();
    if (!factory) {
      return { clients: [], leads: [], source: "postgres", unavailable: true };
    }
    const supabase = await factory();
    const [clients, leads] = await Promise.all([
      listCrmClientsFromDatabase(supabase, session.user.organizationId),
      listCrmLeadsFromDatabase(supabase, session.user.organizationId),
    ]);
    if ("error" in clients || "error" in leads) {
      return { clients: [], leads: [], source: "postgres", unavailable: true };
    }
    return { clients, leads, source: "postgres", unavailable: false };
  }
  const workspace = getWorkspace();
  return { clients: workspace.clients, leads: workspace.leads, source: "demo-memory", unavailable: false };
}

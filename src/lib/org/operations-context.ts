import { createSupabaseServer, getSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/data/store";
import { listCrmClientsFromDatabase, shouldUseCrmDatabase } from "@/lib/org/crm";
import {
  listOpsExpenses,
  listOpsProjects,
  listOpsRevenue,
  listOpsTasks,
  operationalTotals,
  OPS_ESTIMATE_NOTE,
  shouldUseOpsDatabase,
} from "@/lib/org/operations";
import type { ClientRecord, Expense, Project, RevenueEntry, TaskItem } from "@/lib/types";

function emptyTotals() {
  return operationalTotals({ expenses: [], revenue: [], projects: [], tasks: [] });
}

export async function loadVisibleOpsRecords(): Promise<{
  expenses: Expense[];
  revenue: RevenueEntry[];
  projects: Project[];
  tasks: TaskItem[];
  clients: ClientRecord[];
  source: "postgres" | "demo-memory";
  unavailable: boolean;
  totals: ReturnType<typeof operationalTotals>;
  estimateNote: string;
}> {
  const session = await getSession();
  const workspace = getWorkspace();
  if (session.user?.source === "supabase" && !session.user.mfaVerified) {
    return {
      expenses: [],
      revenue: [],
      projects: [],
      tasks: [],
      clients: [],
      source: "postgres",
      unavailable: true,
      totals: emptyTotals(),
      estimateNote: OPS_ESTIMATE_NOTE,
    };
  }
  if (!shouldUseOpsDatabase(session.user) || !session.user?.organizationId) {
    return {
      expenses: workspace.expenses,
      revenue: workspace.revenue,
      projects: workspace.projects,
      tasks: workspace.tasks,
      clients: workspace.clients,
      source: "demo-memory",
      unavailable: false,
      totals: operationalTotals({
        expenses: workspace.expenses,
        revenue: workspace.revenue,
        projects: workspace.projects,
        tasks: workspace.tasks,
      }),
      estimateNote: OPS_ESTIMATE_NOTE,
    };
  }

  const factory = createSupabaseServer();
  if (!factory) {
    return {
      expenses: [],
      revenue: [],
      projects: [],
      tasks: [],
      clients: [],
      source: "postgres",
      unavailable: true,
      totals: emptyTotals(),
      estimateNote: OPS_ESTIMATE_NOTE,
    };
  }

  const supabase = await factory();
  const organizationId = session.user.organizationId;
  const [expenses, revenue, projects, tasks, clients] = await Promise.all([
    listOpsExpenses(supabase, organizationId),
    listOpsRevenue(supabase, organizationId),
    listOpsProjects(supabase, organizationId),
    listOpsTasks(supabase, organizationId),
    shouldUseCrmDatabase(session.user)
      ? listCrmClientsFromDatabase(supabase, organizationId)
      : Promise.resolve(workspace.clients),
  ]);

  if ("error" in expenses || "error" in revenue || "error" in projects || "error" in tasks || "error" in clients) {
    return {
      expenses: [],
      revenue: [],
      projects: [],
      tasks: [],
      clients: [],
      source: "postgres",
      unavailable: true,
      totals: emptyTotals(),
      estimateNote: OPS_ESTIMATE_NOTE,
    };
  }

  return {
    expenses,
    revenue,
    projects,
    tasks,
    clients,
    source: "postgres",
    unavailable: false,
    totals: operationalTotals({ expenses, revenue, projects, tasks }),
    estimateNote: OPS_ESTIMATE_NOTE,
  };
}

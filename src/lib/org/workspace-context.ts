import { createSupabaseServer, getSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/data/store";
import { listCrmClientsFromDatabase, listCrmLeadsFromDatabase, shouldUseCrmDatabase } from "@/lib/org/crm";
import { listOpsProjects, listOpsTasks, shouldUseOpsDatabase } from "@/lib/org/operations";
import {
  listWorkspaceDocuments,
  listWorkspaceEvents,
  listWorkspaceInvoices,
  listWorkspaceNotes,
  shouldUseWorkspaceDatabase,
  workspaceSummaries,
  WORKSPACE_RECORD_NOTE,
} from "@/lib/org/workspace";
import type {
  CalendarEvent,
  ClientRecord,
  Lead,
  OsDocument,
  OwnerNote,
  Project,
  TaskItem,
  WorkspaceInvoice,
} from "@/lib/types";

export async function loadVisibleWorkspaceRecords(): Promise<{
  notes: OwnerNote[];
  documents: OsDocument[];
  events: CalendarEvent[];
  invoices: WorkspaceInvoice[];
  clients: ClientRecord[];
  leads: Lead[];
  projects: Project[];
  tasks: TaskItem[];
  source: "postgres" | "demo-memory";
  unavailable: boolean;
  recordNote: string;
  summaries: ReturnType<typeof workspaceSummaries>;
}> {
  const session = await getSession();
  const workspace = getWorkspace();
  if (session.user?.source === "supabase" && !session.user.mfaVerified) {
    return emptyWorkspace("postgres", true);
  }
  if (!shouldUseWorkspaceDatabase(session.user) || !session.user?.organizationId) {
    return {
      notes: workspace.notes,
      documents: workspace.osDocuments,
      events: workspace.events,
      invoices: workspace.workspaceInvoices,
      clients: workspace.clients,
      leads: workspace.leads,
      projects: workspace.projects,
      tasks: workspace.tasks,
      source: "demo-memory",
      unavailable: false,
      recordNote: WORKSPACE_RECORD_NOTE,
      summaries: workspaceSummaries({
        notes: workspace.notes,
        documents: workspace.osDocuments,
        events: workspace.events,
        invoices: workspace.workspaceInvoices,
      }),
    };
  }

  const factory = createSupabaseServer();
  if (!factory) {
    return emptyWorkspace("postgres", true);
  }

  const supabase = await factory();
  const organizationId = session.user.organizationId;
  const [notes, documents, events, invoices, clients, leads, projects, tasks] = await Promise.all([
    listWorkspaceNotes(supabase, organizationId),
    listWorkspaceDocuments(supabase, organizationId),
    listWorkspaceEvents(supabase, organizationId),
    listWorkspaceInvoices(supabase, organizationId),
    shouldUseCrmDatabase(session.user)
      ? listCrmClientsFromDatabase(supabase, organizationId)
      : Promise.resolve(workspace.clients),
    shouldUseCrmDatabase(session.user)
      ? listCrmLeadsFromDatabase(supabase, organizationId)
      : Promise.resolve(workspace.leads),
    shouldUseOpsDatabase(session.user) ? listOpsProjects(supabase, organizationId) : Promise.resolve(workspace.projects),
    shouldUseOpsDatabase(session.user) ? listOpsTasks(supabase, organizationId) : Promise.resolve(workspace.tasks),
  ]);

  if (
    "error" in notes ||
    "error" in documents ||
    "error" in events ||
    "error" in invoices ||
    "error" in clients ||
    "error" in leads ||
    "error" in projects ||
    "error" in tasks
  ) {
    return emptyWorkspace("postgres", true);
  }

  return {
    notes,
    documents,
    events,
    invoices,
    clients,
    leads,
    projects,
    tasks,
    source: "postgres",
    unavailable: false,
    recordNote: WORKSPACE_RECORD_NOTE,
    summaries: workspaceSummaries({ notes, documents, events, invoices }),
  };
}

function emptyWorkspace(source: "postgres" | "demo-memory", unavailable: boolean) {
  return {
    notes: [] as OwnerNote[],
    documents: [] as OsDocument[],
    events: [] as CalendarEvent[],
    invoices: [] as WorkspaceInvoice[],
    clients: [] as ClientRecord[],
    leads: [] as Lead[],
    projects: [] as Project[],
    tasks: [] as TaskItem[],
    source,
    unavailable,
    recordNote: WORKSPACE_RECORD_NOTE,
    summaries: workspaceSummaries({ notes: [], documents: [], events: [], invoices: [] }),
  };
}

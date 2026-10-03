import { createSupabaseServer, getSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/data/store";
import { listCrmClientsFromDatabase, listCrmLeadsFromDatabase, shouldUseCrmDatabase } from "@/lib/org/crm";
import { listOpsProjects, listOpsTasks, shouldUseOpsDatabase } from "@/lib/org/operations";
import {
  listWorkspaceDocuments,
  listWorkspaceEvents,
  listWorkspaceInvoices,
  listWorkspaceNotes,
  listWorkspaceSchedule,
  shouldUseWorkspaceDatabase,
  workspaceSummaries,
  WORKSPACE_RECORD_NOTE,
} from "@/lib/org/workspace";
import {
  buildInternalSchedule,
  derivedGeneratedCalendarEvents,
  kickoffProjectIds,
  mergeCalendarEvents,
  SCHEDULE_RECORD_NOTE,
} from "@/lib/org/schedule-model";
import { listWorkspaceEstimates, shouldUseEstimateDatabase } from "@/lib/org/estimates";
import type {
  CalendarEvent,
  ClientRecord,
  InternalScheduleItem,
  Lead,
  OsDocument,
  OwnerNote,
  Project,
  TaskItem,
  WorkspaceEstimate,
  WorkspaceInvoice,
} from "@/lib/types";

export async function loadVisibleWorkspaceRecords(): Promise<{
  notes: OwnerNote[];
  documents: OsDocument[];
  events: CalendarEvent[];
  invoices: WorkspaceInvoice[];
  estimates: WorkspaceEstimate[];
  clients: ClientRecord[];
  leads: Lead[];
  projects: Project[];
  tasks: TaskItem[];
  schedule: InternalScheduleItem[];
  kickoffByInvoiceId: Record<string, string>;
  source: "postgres" | "demo-memory";
  unavailable: boolean;
  recordNote: string;
  scheduleNote: string;
  summaries: ReturnType<typeof workspaceSummaries>;
}> {
  const session = await getSession();
  const workspace = getWorkspace();
  if (session.user?.source === "supabase" && !session.user.mfaVerified) {
    return emptyWorkspace("postgres", true);
  }
  if (!shouldUseWorkspaceDatabase(session.user) || !session.user?.organizationId) {
    const generated = derivedGeneratedCalendarEvents({
      projects: workspace.projects,
      tasks: workspace.tasks,
      estimates: workspace.workspaceEstimates,
      invoices: workspace.workspaceInvoices,
    });
    const events = mergeCalendarEvents(workspace.events, generated);
    return {
      notes: workspace.notes,
      documents: workspace.osDocuments,
      events,
      invoices: workspace.workspaceInvoices,
      estimates: workspace.workspaceEstimates,
      clients: workspace.clients,
      leads: workspace.leads,
      projects: workspace.projects,
      tasks: workspace.tasks,
      schedule: buildInternalSchedule({
        projects: workspace.projects,
        tasks: workspace.tasks,
        estimates: workspace.workspaceEstimates,
        invoices: workspace.workspaceInvoices,
        events: workspace.events,
      }),
      kickoffByInvoiceId: kickoffProjectIds(workspace.projects),
      source: "demo-memory",
      unavailable: false,
      recordNote: WORKSPACE_RECORD_NOTE,
      scheduleNote: SCHEDULE_RECORD_NOTE,
      summaries: workspaceSummaries({
        notes: workspace.notes,
        documents: workspace.osDocuments,
        events,
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
  const [notes, documents, events, invoices, estimates, clients, leads, projects, tasks, schedule] = await Promise.all([
    listWorkspaceNotes(supabase, organizationId),
    listWorkspaceDocuments(supabase, organizationId),
    listWorkspaceEvents(supabase, organizationId),
    listWorkspaceInvoices(supabase, organizationId),
    shouldUseEstimateDatabase(session.user)
      ? listWorkspaceEstimates(supabase, organizationId)
      : Promise.resolve(workspace.workspaceEstimates),
    shouldUseCrmDatabase(session.user)
      ? listCrmClientsFromDatabase(supabase, organizationId)
      : Promise.resolve(workspace.clients),
    shouldUseCrmDatabase(session.user)
      ? listCrmLeadsFromDatabase(supabase, organizationId)
      : Promise.resolve(workspace.leads),
    shouldUseOpsDatabase(session.user) ? listOpsProjects(supabase, organizationId) : Promise.resolve(workspace.projects),
    shouldUseOpsDatabase(session.user) ? listOpsTasks(supabase, organizationId) : Promise.resolve(workspace.tasks),
    listWorkspaceSchedule(supabase, organizationId),
  ]);

  if (
    "error" in notes ||
    "error" in documents ||
    "error" in events ||
    "error" in invoices ||
    "error" in estimates ||
    "error" in clients ||
    "error" in leads ||
    "error" in projects ||
    "error" in tasks ||
    "error" in schedule
  ) {
    return emptyWorkspace("postgres", true);
  }

  return {
    notes,
    documents,
    events,
    invoices,
    estimates,
    clients,
    leads,
    projects,
    tasks,
    schedule,
    kickoffByInvoiceId: kickoffProjectIds(projects),
    source: "postgres",
    unavailable: false,
    recordNote: WORKSPACE_RECORD_NOTE,
    scheduleNote: SCHEDULE_RECORD_NOTE,
    summaries: workspaceSummaries({ notes, documents, events, invoices }),
  };
}

function emptyWorkspace(source: "postgres" | "demo-memory", unavailable: boolean) {
  return {
    notes: [] as OwnerNote[],
    documents: [] as OsDocument[],
    events: [] as CalendarEvent[],
    invoices: [] as WorkspaceInvoice[],
    estimates: [] as WorkspaceEstimate[],
    clients: [] as ClientRecord[],
    leads: [] as Lead[],
    projects: [] as Project[],
    tasks: [] as TaskItem[],
    schedule: [] as InternalScheduleItem[],
    kickoffByInvoiceId: {} as Record<string, string>,
    source,
    unavailable,
    recordNote: WORKSPACE_RECORD_NOTE,
    scheduleNote: SCHEDULE_RECORD_NOTE,
    summaries: workspaceSummaries({ notes: [], documents: [], events: [], invoices: [] }),
  };
}

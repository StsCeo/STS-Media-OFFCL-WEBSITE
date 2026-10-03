import { centsToDollars } from "@/lib/money";
import type {
  CalendarEvent,
  InternalScheduleItem,
  Project,
  ScheduleSourceType,
  ScheduleViewFilter,
  TaskItem,
  WorkspaceEstimate,
  WorkspaceInvoice,
} from "@/lib/types";

export const GENERIC_SCHEDULE_ERROR = "The schedule could not be updated.";
export const GENERIC_KICKOFF_ERROR = "The project could not be started from this invoice.";
export const SCHEDULE_RECORD_NOTE =
  "Internal organization schedule. Source dates stay in this system. Google, Apple, Outlook, email, and reminders are not connected.";
export const SCHEDULE_RECONCILE_RPC = "sts_reconcile_ws_schedule";
export const PROJECT_KICKOFF_RPC = "sts_start_project_from_invoice";
export const SCHEDULE_DATE_MIN = "2000-01-01";
export const SCHEDULE_DATE_MAX = "2100-01-01";

export const SCHEDULE_SOURCE_TYPES: ScheduleSourceType[] = [
  "manual",
  "project_start",
  "project_deadline",
  "task_due",
  "estimate_expires",
  "invoice_due",
];

export const SCHEDULE_SOURCE_LABELS: Record<ScheduleSourceType, string> = {
  manual: "Manual event",
  project_start: "Project start",
  project_deadline: "Project deadline",
  task_due: "Task due",
  estimate_expires: "Estimate expiration",
  invoice_due: "Invoice due",
};

export function isScheduleSourceType(value: string | null | undefined): value is ScheduleSourceType {
  return SCHEDULE_SOURCE_TYPES.includes(value as ScheduleSourceType);
}

export function scheduleSourceLabel(value: string | null | undefined) {
  return isScheduleSourceType(value) ? SCHEDULE_SOURCE_LABELS[value] : "Unknown source";
}

export const SCHEDULE_VIEW_FILTERS: ScheduleViewFilter[] = ["all", "today", "upcoming", "overdue"];

export function isScheduleViewFilter(value: string | null | undefined): value is ScheduleViewFilter {
  return SCHEDULE_VIEW_FILTERS.includes(value as ScheduleViewFilter);
}

export function scheduleFilterHref(filter: ScheduleViewFilter) {
  return filter === "all" ? "/dashboard/calendar" : `/dashboard/calendar?schedule=${filter}`;
}

export function isValidScheduleDate(value: string | null | undefined) {
  const date = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= SCHEDULE_DATE_MIN && date <= SCHEDULE_DATE_MAX;
}

export function scheduleBucket(occursOn: string, today: string): Exclude<ScheduleViewFilter, "all"> {
  const day = occursOn.slice(0, 10);
  if (day === today) return "today";
  if (day < today) return "overdue";
  return "upcoming";
}

export function filterSchedule(
  items: InternalScheduleItem[],
  view: ScheduleViewFilter,
  today: string,
) {
  if (view === "all") return items;
  return items.filter((item) => scheduleBucket(item.occursOn, today) === view);
}

export function eventOccursOn(event: Pick<CalendarEvent, "start" | "allDay">) {
  return event.start.slice(0, 10);
}

export function filterCalendarEvents(
  events: CalendarEvent[],
  view: ScheduleViewFilter,
  today: string,
) {
  if (view === "all") return events;
  return events.filter((event) => scheduleBucket(eventOccursOn(event), today) === view);
}

export function scheduleItemHref(item: Pick<InternalScheduleItem, "sourceType" | "sourceId">) {
  if (item.sourceType === "project_start" || item.sourceType === "project_deadline") {
    return `/dashboard/projects/${item.sourceId}`;
  }
  if (item.sourceType === "task_due") return "/dashboard/tasks";
  if (item.sourceType === "estimate_expires") return "/dashboard/estimates";
  if (item.sourceType === "invoice_due") return "/dashboard/invoices";
  return "/dashboard/calendar";
}

function allDayBounds(occursOn: string): Pick<CalendarEvent, "start" | "end" | "allDay" | "timezone"> {
  return {
    start: `${occursOn}T00:00:00.000Z`,
    end: `${occursOn}T23:59:59.000Z`,
    allDay: true,
    timezone: "UTC",
  };
}

export function derivedGeneratedCalendarEvents(input: {
  projects: Project[];
  tasks: TaskItem[];
  estimates: WorkspaceEstimate[];
  invoices: WorkspaceInvoice[];
}): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const project of input.projects) {
    if (project.stage === "completed") continue;
    if (isValidScheduleDate(project.startDate)) {
      events.push({
        id: `generated:project_start:${project.id}`,
        title: `Project start: ${project.name}`.slice(0, 160),
        kind: "deadline",
        notes: "",
        relatedId: project.id,
        location: "",
        clientId: project.clientId || null,
        projectId: project.id,
        generated: true,
        sourceType: "project_start",
        sourceId: project.id,
        ...allDayBounds(project.startDate.slice(0, 10)),
      });
    }
    if (isValidScheduleDate(project.deadline)) {
      events.push({
        id: `generated:project_deadline:${project.id}`,
        title: `Project deadline: ${project.name}`.slice(0, 160),
        kind: "deadline",
        notes: "",
        relatedId: project.id,
        location: "",
        clientId: project.clientId || null,
        projectId: project.id,
        generated: true,
        sourceType: "project_deadline",
        sourceId: project.id,
        ...allDayBounds(project.deadline.slice(0, 10)),
      });
    }
  }
  for (const task of input.tasks) {
    if (task.status === "done" || !isValidScheduleDate(task.dueDate)) continue;
    events.push({
      id: `generated:task_due:${task.id}`,
      title: `Task due: ${task.title}`.slice(0, 160),
      kind: "task",
      notes: "",
      relatedId: task.id,
      location: "",
      clientId: task.clientId,
      projectId: task.projectId,
      generated: true,
      sourceType: "task_due",
      sourceId: task.id,
      ...allDayBounds(task.dueDate!.slice(0, 10)),
    });
  }
  for (const estimate of input.estimates) {
    if (estimate.archived || estimate.status === "declined" || estimate.status === "expired") continue;
    if (!isValidScheduleDate(estimate.expiresOn)) continue;
    events.push({
      id: `generated:estimate_expires:${estimate.id}`,
      title: `Estimate expires: ${estimate.estimateNumber}`.slice(0, 160),
      kind: "deadline",
      notes: "",
      relatedId: estimate.id,
      location: "",
      clientId: estimate.clientId,
      projectId: null,
      generated: true,
      sourceType: "estimate_expires",
      sourceId: estimate.id,
      ...allDayBounds(estimate.expiresOn!.slice(0, 10)),
    });
  }
  for (const invoice of input.invoices) {
    if (invoice.archived || invoice.status === "paid" || invoice.status === "void") continue;
    if (!isValidScheduleDate(invoice.dueDate)) continue;
    events.push({
      id: `generated:invoice_due:${invoice.id}`,
      title: `Invoice due: ${invoice.invoiceNumber}`.slice(0, 160),
      kind: "invoice_due",
      notes: "",
      relatedId: invoice.id,
      location: "",
      clientId: invoice.clientId,
      projectId: null,
      generated: true,
      sourceType: "invoice_due",
      sourceId: invoice.id,
      ...allDayBounds(invoice.dueDate!.slice(0, 10)),
    });
  }
  return events;
}

export function mergeCalendarEvents(manual: CalendarEvent[], generated: CalendarEvent[]) {
  const liveManual = manual.filter((event) => !event.generated);
  const keys = new Set(
    liveManual
      .filter((event) => event.sourceType && event.sourceId)
      .map((event) => `${event.sourceType}:${event.sourceId}`),
  );
  const extra = generated.filter((event) => !keys.has(`${event.sourceType}:${event.sourceId}`));
  return [...liveManual, ...extra].sort((a, b) => a.start.localeCompare(b.start));
}

export function buildInternalSchedule(input: {
  projects: Project[];
  tasks: TaskItem[];
  estimates: WorkspaceEstimate[];
  invoices: WorkspaceInvoice[];
  events: CalendarEvent[];
}): InternalScheduleItem[] {
  const items: InternalScheduleItem[] = [];
  for (const project of input.projects) {
    if (project.stage === "completed") continue;
    if (isValidScheduleDate(project.startDate)) {
      items.push({
        id: `project_start:${project.id}`,
        sourceType: "project_start",
        sourceId: project.id,
        title: `Project start: ${project.name}`.slice(0, 160),
        occursOn: project.startDate.slice(0, 10),
        sourceStatus: project.stage,
        generated: true,
      });
    }
    if (isValidScheduleDate(project.deadline)) {
      items.push({
        id: `project_deadline:${project.id}`,
        sourceType: "project_deadline",
        sourceId: project.id,
        title: `Project deadline: ${project.name}`.slice(0, 160),
        occursOn: project.deadline.slice(0, 10),
        sourceStatus: project.stage,
        generated: true,
      });
    }
  }
  for (const task of input.tasks) {
    if (task.status === "done" || !isValidScheduleDate(task.dueDate)) continue;
    items.push({
      id: `task_due:${task.id}`,
      sourceType: "task_due",
      sourceId: task.id,
      title: `Task due: ${task.title}`.slice(0, 160),
      occursOn: task.dueDate!.slice(0, 10),
      sourceStatus: task.status,
      generated: true,
    });
  }
  for (const estimate of input.estimates) {
    if (estimate.archived || estimate.status === "declined" || estimate.status === "expired") continue;
    if (!isValidScheduleDate(estimate.expiresOn)) continue;
    items.push({
      id: `estimate_expires:${estimate.id}`,
      sourceType: "estimate_expires",
      sourceId: estimate.id,
      title: `Estimate expires: ${estimate.estimateNumber}`.slice(0, 160),
      occursOn: estimate.expiresOn!.slice(0, 10),
      sourceStatus: estimate.status,
      generated: true,
    });
  }
  for (const invoice of input.invoices) {
    if (invoice.archived || invoice.status === "paid" || invoice.status === "void") continue;
    if (!isValidScheduleDate(invoice.dueDate)) continue;
    items.push({
      id: `invoice_due:${invoice.id}`,
      sourceType: "invoice_due",
      sourceId: invoice.id,
      title: `Invoice due: ${invoice.invoiceNumber}`.slice(0, 160),
      occursOn: invoice.dueDate!.slice(0, 10),
      sourceStatus: invoice.status,
      generated: true,
    });
  }
  for (const event of input.events) {
    if (event.generated) continue;
    items.push({
      id: `manual:${event.id}`,
      sourceType: "manual",
      sourceId: event.id,
      title: event.title,
      occursOn: eventOccursOn(event),
      sourceStatus: event.kind,
      generated: false,
    });
  }
  return items.sort((a, b) => a.occursOn.localeCompare(b.occursOn) || a.title.localeCompare(b.title));
}

export function mapScheduleRow(row: Record<string, unknown>): InternalScheduleItem {
  const sourceType = isScheduleSourceType(String(row.source_type || "")) ? (row.source_type as ScheduleSourceType) : "manual";
  return {
    id: String(row.id),
    sourceType,
    sourceId: String(row.source_id || ""),
    title: String(row.title || ""),
    occursOn: String(row.occurs_on || "").slice(0, 10),
    sourceStatus: String(row.source_status || ""),
    generated: sourceType !== "manual",
  };
}

export function kickoffProjectIds(projects: Array<Pick<Project, "id" | "sourceInvoiceId">>) {
  const mapped: Record<string, string> = {};
  for (const project of projects) {
    if (project.sourceInvoiceId) mapped[project.sourceInvoiceId] = project.id;
  }
  return mapped;
}

export function canStartProjectFromInvoice(
  invoice: Pick<WorkspaceInvoice, "id" | "archived" | "sourceEstimateId">,
  estimate: Pick<WorkspaceEstimate, "id" | "status" | "archived"> | null | undefined,
  existingProjectId?: string | null,
) {
  if (existingProjectId) return false;
  if (invoice.archived || !invoice.sourceEstimateId) return false;
  if (!estimate || estimate.archived || estimate.status !== "accepted") return false;
  return true;
}

export function draftProjectFromConvertedInvoice(
  invoice: WorkspaceInvoice,
  estimate: WorkspaceEstimate,
  today = new Date().toISOString().slice(0, 10),
): Project {
  const name = (estimate.title.trim() || `Project from ${invoice.invoiceNumber}`).slice(0, 160);
  return {
    id: `proj-from-${invoice.id}`,
    name: name.length >= 2 ? name : "Project from invoice",
    clientId: invoice.clientId || "",
    packageId: null,
    stage: "discovery",
    startDate: today,
    deadline: invoice.dueDate || "",
    budget: centsToDollars(invoice.totalCents),
    amountInvoiced: 0,
    amountCollected: 0,
    directCost: 0,
    githubRepo: "",
    vercelProject: "",
    productionUrl: "",
    domain: "",
    maintenancePlan: "",
    credentialsReference: "Stored outside this system. Record only the location of the vault, never the secret.",
    notes: "",
    atRisk: false,
    sourceInvoiceId: invoice.id,
    sourceEstimateId: invoice.sourceEstimateId,
  };
}

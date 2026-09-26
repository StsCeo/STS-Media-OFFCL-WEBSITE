import type { DatePreset, Expense, Lead, Project, RevenueEntry, TaskItem, WorkspaceInvoice, CalendarEvent } from "@/lib/types";
import { rangeFromPreset } from "@/lib/finance";
import { inRange } from "@/lib/utils";
import { operationalTotals } from "@/lib/org/operations";
import { COMMAND_CENTER_PIPELINE_KEYS, PIPELINE_COLUMNS, pipelineCounts } from "@/lib/org/crm-pipeline";

export type CommandCenterPeriod = Extract<DatePreset, "month" | "last_month" | "quarter" | "year" | "custom">;

export const COMMAND_CENTER_PERIODS: { value: CommandCenterPeriod; label: string }[] = [
  { value: "month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
  { value: "custom", label: "Custom" },
];

export function parseCommandCenterPeriod(value: string | null | undefined): CommandCenterPeriod {
  if (value === "last_month" || value === "quarter" || value === "year" || value === "custom") return value;
  return "month";
}

export type AgendaBucket = "today" | "upcoming" | "overdue";

export type AgendaItem = {
  id: string;
  bucket: AgendaBucket;
  label: string;
  href: string;
  date: string;
};

function dayStamp(value: Date) {
  return value.toISOString().slice(0, 10);
}

function classifyDate(date: string, today: string): AgendaBucket | null {
  if (!date) return null;
  const stamp = date.slice(0, 10);
  if (stamp === today) return "today";
  if (stamp < today) return "overdue";
  return "upcoming";
}

export function deriveOperationalAgenda(input: {
  tasks: TaskItem[];
  leads: Lead[];
  invoices: WorkspaceInvoice[];
  projects: Project[];
  events: CalendarEvent[];
  now?: Date;
}): AgendaItem[] {
  const today = dayStamp(input.now ?? new Date());
  const items: AgendaItem[] = [];

  for (const task of input.tasks) {
    if (task.status === "done" || !task.dueDate) continue;
    const bucket = classifyDate(task.dueDate, today);
    if (!bucket) continue;
    items.push({
      id: `task-${task.id}`,
      bucket,
      label: task.title,
      href: "/dashboard/tasks",
      date: task.dueDate.slice(0, 10),
    });
  }

  for (const lead of input.leads) {
    if (!lead.nextFollowUp || lead.stage === "won" || lead.stage === "lost") continue;
    const bucket = classifyDate(lead.nextFollowUp, today);
    if (!bucket) continue;
    items.push({
      id: `lead-${lead.id}`,
      bucket,
      label: `Lead follow-up — ${lead.businessName}`,
      href: `/dashboard/leads?lead=${lead.id}`,
      date: lead.nextFollowUp.slice(0, 10),
    });
  }

  for (const invoice of input.invoices) {
    if (invoice.archived || invoice.status === "paid" || invoice.status === "void" || !invoice.dueDate) continue;
    const bucket = classifyDate(invoice.dueDate, today);
    if (!bucket) continue;
    items.push({
      id: `invoice-${invoice.id}`,
      bucket,
      label: `Invoice ${invoice.invoiceNumber} due`,
      href: "/dashboard/invoices",
      date: invoice.dueDate.slice(0, 10),
    });
  }

  for (const project of input.projects) {
    if (!project.deadline || project.stage === "completed") continue;
    const bucket = classifyDate(project.deadline, today);
    if (!bucket) continue;
    items.push({
      id: `project-${project.id}`,
      bucket,
      label: `${project.name} — deadline`,
      href: `/dashboard/projects/${project.id}`,
      date: project.deadline.slice(0, 10),
    });
  }

  for (const event of input.events) {
    const start = event.start.slice(0, 10);
    const bucket = classifyDate(start, today);
    if (!bucket) continue;
    items.push({
      id: `event-${event.id}`,
      bucket,
      label: event.title,
      href: "/dashboard/calendar",
      date: start,
    });
  }

  return items.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
}

export function periodFinancials(input: {
  expenses: Expense[];
  revenue: RevenueEntry[];
  invoices: WorkspaceInvoice[];
  projects: Project[];
  tasks: TaskItem[];
  range: { from: Date; to: Date };
  now?: Date;
}) {
  const rangedExpenses = input.expenses.filter(
    (item) => !item.archived && inRange(item.transactionDate, input.range.from, input.range.to),
  );
  const rangedRevenue = input.revenue.filter((item) => inRange(item.date, input.range.from, input.range.to));
  const totals = operationalTotals({
    expenses: rangedExpenses,
    revenue: rangedRevenue,
    projects: input.projects,
    tasks: input.tasks,
    now: input.now,
  });
  const outstandingInvoices = input.invoices
    .filter((item) => !item.archived && item.status !== "paid" && item.status !== "void")
    .reduce((sum, item) => sum + Math.max(0, item.totalCents - item.amountPaidCents) / 100, 0);
  return {
    ...totals,
    outstandingInvoices,
  };
}

export function commandCenterSnapshot(input: {
  expenses: Expense[];
  revenue: RevenueEntry[];
  invoices: WorkspaceInvoice[];
  projects: Project[];
  tasks: TaskItem[];
  activeClients: number;
  source: "postgres" | "demo-memory";
  period: CommandCenterPeriod;
  customFrom?: Date;
  customTo?: Date;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const range = rangeFromPreset(input.period, input.customFrom, input.customTo, now);
  const financials = periodFinancials({
    expenses: input.expenses,
    revenue: input.revenue,
    invoices: input.invoices,
    projects: input.projects,
    tasks: input.tasks,
    range,
    now,
  });
  return {
    range,
    revenue: financials.totalRevenue,
    expenses: financials.totalExpenses,
    profit: financials.netIncome,
    outstandingInvoices: financials.outstandingInvoices,
    activeClients: input.activeClients,
    mrrAvailable: false as const,
    mrrNote:
      input.source === "postgres"
        ? "MRR is unavailable until recurring services have a Postgres source."
        : "MRR is unavailable until recurring services are tracked in the organization ledger.",
  };
}

export function compactPipelineSummary(leads: Lead[]) {
  const counts = pipelineCounts(leads);
  return COMMAND_CENTER_PIPELINE_KEYS.map((key) => {
    const column = PIPELINE_COLUMNS.find((item) => item.key === key)!;
    return { key, label: column.label, count: counts[key], href: `/dashboard/leads?stage=${key}` };
  });
}

export function businessHealthMetrics(input: {
  leads: Lead[];
  invoices: WorkspaceInvoice[];
  activeClients: number;
  range: { from: Date; to: Date };
}) {
  const leadsThisPeriod = input.leads.filter((lead) => inRange(lead.createdAt, input.range.from, input.range.to));
  const won = input.leads.filter((lead) => lead.stage === "won");
  const lost = input.leads.filter((lead) => lead.stage === "lost");
  const decided = won.length + lost.length;
  const averageDeal =
    won.length === 0 ? null : won.reduce((sum, lead) => sum + lead.estimatedValue, 0) / won.length;
  const outstanding = input.invoices
    .filter((item) => !item.archived && item.status !== "paid" && item.status !== "void")
    .reduce((sum, item) => sum + Math.max(0, item.totalCents - item.amountPaidCents) / 100, 0);
  return {
    leadsThisPeriod: leadsThisPeriod.length,
    conversionRate: decided === 0 ? null : Math.round((won.length / decided) * 100),
    averageDealValue: averageDeal,
    outstandingInvoices: outstanding,
    activeClients: input.activeClients,
  };
}

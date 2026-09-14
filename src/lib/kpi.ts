import type { WorkspaceState } from "./types";
import { FINANCE_DEFINITIONS, type FinanceMetrics } from "./finance";
import { formatCurrency } from "./utils";

export type KpiFormat = "money" | "count" | "text";

export interface OverviewKpi {
  label: string;
  value: number | string;
  hint: string;
  format: KpiFormat;
}

export function formatWholeNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

export function formatKpiValue(value: number | string, format: KpiFormat) {
  if (format === "text" || typeof value === "string") return String(value);
  if (format === "count") return formatWholeNumber(value);
  return formatCurrency(value);
}

export function buildOverviewKpis(
  workspace: WorkspaceState,
  metrics: FinanceMetrics,
  conversions: number,
): OverviewKpi[] {
  const proposalSet = workspace.leads.filter((lead) =>
    ["proposal_sent", "negotiating", "won", "lost"].includes(lead.stage),
  );
  const won = workspace.leads.filter((lead) => lead.stage === "won").length;
  const proposalConversion =
    won && proposalSet.length ? `${Math.round((won / proposalSet.length) * 100)}%` : "—";
  const trafficTotal = workspace.websiteTraffic.reduce((sum, row) => sum + row.visits, 0);

  return [
    { label: "Gross revenue", value: metrics.grossRevenue, hint: FINANCE_DEFINITIONS.grossRevenue, format: "money" },
    { label: "MRR", value: metrics.mrr, hint: FINANCE_DEFINITIONS.mrr, format: "money" },
    { label: "ARR", value: metrics.arr, hint: FINANCE_DEFINITIONS.arr, format: "money" },
    { label: "Gross profit", value: metrics.grossProfit, hint: FINANCE_DEFINITIONS.grossProfit, format: "money" },
    { label: "Net profit", value: metrics.netProfit, hint: FINANCE_DEFINITIONS.netProfit, format: "money" },
    { label: "Total expenses", value: metrics.totalExpenses, hint: "All recognized expenses in range.", format: "money" },
    { label: "Cash collected", value: metrics.cashCollected, hint: FINANCE_DEFINITIONS.cashCollected, format: "money" },
    { label: "Outstanding invoices", value: metrics.outstandingInvoices, hint: FINANCE_DEFINITIONS.outstandingInvoices, format: "money" },
    { label: "Active clients", value: workspace.clients.filter((client) => client.status === "active").length, hint: "Clients marked active.", format: "count" },
    { label: "Active projects", value: workspace.projects.filter((project) => !["completed", "on_hold"].includes(project.stage)).length, hint: "Projects not completed or on hold.", format: "count" },
    { label: "New leads", value: workspace.leads.filter((lead) => lead.stage === "new_inquiry").length, hint: "Leads in New inquiry.", format: "count" },
    { label: "Booked calls", value: workspace.events.filter((event) => event.kind === "client_meeting").length, hint: "Client meetings on the calendar.", format: "count" },
    { label: "Emails sent", value: workspace.emailsSentCount, hint: "Logged send count. Inbox sync is Phase 2.", format: "count" },
    { label: "Calls made", value: workspace.callsMadeCount, hint: "Logged call count.", format: "count" },
    {
      label: "Proposal conversion",
      value: proposalConversion,
      hint: "Won / (proposal sent + negotiating + won + lost). Hidden when the set is empty.",
      format: "text",
    },
    {
      label: "Website traffic",
      value: trafficTotal || "Needs analytics setup",
      hint: "No fabricated traffic. Connect analytics in Phase 2.",
      format: trafficTotal ? "count" : "text",
    },
    { label: "Contact-form conversions", value: conversions, hint: "New contact submissions in the workspace.", format: "count" },
  ];
}

import { differenceInCalendarDays, isBefore, parseISO } from "date-fns";
import { computeFinance, rangeFromPreset } from "./finance";
import type { WorkspaceState } from "./types";

export interface Insight {
  id: string;
  title: string;
  body: string;
  evidence: string;
  href: string;
}

export function buildInsights(workspace: WorkspaceState, now = new Date()): Insight[] {
  const insights: Insight[] = [];
  const month = rangeFromPreset("30d", undefined, undefined, now);
  const lastMonth = rangeFromPreset("custom", new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59), now);
  const current = computeFinance(workspace, month);
  const previous = computeFinance(workspace, lastMonth);

  const staleLeads = workspace.leads.filter((lead) => !lead.lastContact && lead.stage === "new_inquiry");
  if (staleLeads.length > 0) {
    insights.push({
      id: "leads-followup",
      title: `${staleLeads.length} lead${staleLeads.length === 1 ? " has" : "s have"} not received a follow-up.`,
      body: "New inquiries with no last-contact date are waiting in the pipeline.",
      evidence: staleLeads.map((lead) => lead.businessName).join(", "),
      href: "/dashboard/leads",
    });
  }

  const awaitingProposal = workspace.leads.filter((lead) => lead.stage === "proposal_sent");
  if (awaitingProposal.length > 0) {
    insights.push({
      id: "proposals",
      title: `${awaitingProposal.length} proposal${awaitingProposal.length === 1 ? " is" : "s are"} awaiting a response.`,
      body: "These leads are in Proposal sent and still open.",
      evidence: awaitingProposal.map((lead) => `${lead.businessName} (last contact ${lead.lastContact ?? "none"})`).join("; "),
      href: "/dashboard/leads",
    });
  }

  const softwareNow = workspace.expenses
    .filter((item) => !item.archived && ["Software and SaaS subscriptions", "AI tools"].includes(item.category) && item.transactionDate >= month.from.toISOString().slice(0, 10))
    .reduce((sum, item) => sum + item.totalAmount, 0);
  const softwarePrev = workspace.expenses
    .filter((item) => !item.archived && ["Software and SaaS subscriptions", "AI tools"].includes(item.category) && item.transactionDate >= lastMonth.from.toISOString().slice(0, 10) && item.transactionDate <= lastMonth.to.toISOString().slice(0, 10))
    .reduce((sum, item) => sum + item.totalAmount, 0);
  if (softwarePrev > 0 && softwareNow > softwarePrev) {
    insights.push({
      id: "software-spend",
      title: "Software spending increased compared with last month.",
      body: "AI tools and SaaS totals are higher in the current 30-day window than in the prior calendar month.",
      evidence: `Current window: $${softwareNow.toFixed(2)}. Prior month: $${softwarePrev.toFixed(2)}.`,
      href: "/dashboard/expenses",
    });
  }

  for (const project of workspace.projects) {
    const openTasks = workspace.tasks.filter((task) => task.projectId === project.id && task.status !== "done");
    const days = differenceInCalendarDays(parseISO(project.deadline), now);
    if (project.atRisk || (days <= 21 && openTasks.length > 0 && project.stage !== "completed")) {
      insights.push({
        id: `project-risk-${project.id}`,
        title: `${project.name} is approaching its deadline with unfinished tasks.`,
        body: `${openTasks.length} open task${openTasks.length === 1 ? "" : "s"} remain. Deadline ${project.deadline}.`,
        evidence: openTasks.map((task) => task.title).join("; ") || "Marked at risk by the project record.",
        href: `/dashboard/projects/${project.id}`,
      });
    }
  }

  const missingReceipts = workspace.expenses.filter((item) => !item.archived && item.receiptStatus === "missing");
  if (missingReceipts.length > 0) {
    insights.push({
      id: "receipts",
      title: `${missingReceipts.length} expense${missingReceipts.length === 1 ? "" : "s"} ${missingReceipts.length === 1 ? "is" : "are"} missing a receipt.`,
      body: "Receipt status is missing on these draft or confirmed transactions.",
      evidence: missingReceipts.map((item) => `${item.vendor} · ${item.description}`).join("; "),
      href: "/dashboard/expenses?view=missing",
    });
  }

  const won = workspace.leads.filter((lead) => lead.stage === "won").length;
  const withCalls = workspace.leads.filter((lead) => lead.meetings > 0 || lead.callsMade > 0).length;
  if (workspace.leads.length >= 3 && withCalls === 0) {
    insights.push({
      id: "lead-to-call",
      title: "Lead-to-call conversion is not measurable yet.",
      body: "There is not enough completed-call data to claim a decline. Log calls before treating this as a trend.",
      evidence: `${workspace.leads.length} leads on file, ${withCalls} with a recorded call or meeting, ${won} won.`,
      href: "/dashboard/leads",
    });
  }

  if (current.grossRevenue === 0 && previous.grossRevenue === 0) {
    insights.push({
      id: "no-revenue-trend",
      title: "Revenue trend is not available until paid revenue exists.",
      body: "Unpaid invoices are excluded from gross revenue and cash collected.",
      evidence: `Recognized revenue this window: $${current.grossRevenue.toFixed(2)}. Cash collected: $${current.cashCollected.toFixed(2)}.`,
      href: "/dashboard/revenue",
    });
  }

  return insights;
}

export function briefing(workspace: WorkspaceState, now = new Date()) {
  const todayKey = now.toISOString().slice(0, 10);
  const meetingsToday = workspace.events.filter((event) => event.start.startsWith(todayKey) && (event.kind === "client_meeting" || event.kind === "team_meeting"));
  const overdue = workspace.tasks.filter((task) => task.status !== "done" && task.dueDate && isBefore(parseISO(task.dueDate), now));
  const priorities = workspace.tasks.filter((task) => task.status !== "done").sort((a, b) => Number(b.priority === "high") - Number(a.priority === "high")).slice(0, 3);
  const followUps = workspace.leads.filter((lead) => !lead.lastContact && lead.stage !== "won" && lead.stage !== "lost");
  const proposals = workspace.leads.filter((lead) => lead.stage === "proposal_sent");
  const outstanding = workspace.invoices.filter((invoice) => !["paid", "void", "draft"].includes(invoice.status));
  const recentPayments = workspace.revenue.filter((item) => item.paymentStatus === "paid").slice(0, 5);
  const atRisk = workspace.projects.filter((project) => project.atRisk);
  const missingReceipts = workspace.expenses.filter((item) => !item.archived && item.receiptStatus === "missing");
  const upcomingCharges = workspace.recurringExpenses.filter((item) => item.active);
  const expiringDomains = workspace.domains;
  const failedDeployments = workspace.deployments.filter((item) => item.status === "failed");
  const contentReview = workspace.content.filter((item) => item.status === "review");
  return {
    meetingsToday,
    overdue,
    priorities,
    followUps,
    proposals,
    outstanding,
    recentPayments,
    atRisk,
    missingReceipts,
    upcomingCharges,
    expiringDomains,
    failedDeployments,
    contentReview,
    insights: buildInsights(workspace, now),
  };
}

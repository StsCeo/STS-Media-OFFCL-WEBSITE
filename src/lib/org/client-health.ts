import type { Lead, Project, TaskItem, WorkspaceInvoice } from "@/lib/types";

export type ClientHealthTone = "success" | "warning" | "danger";

export type ClientHealth = {
  label: "Healthy" | "Needs Attention" | "At Risk";
  tone: ClientHealthTone;
  reason: string;
};

function daysBetween(from: string, to: string) {
  const start = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.floor((end - start) / 86400000);
}

export function clientHealth(input: {
  invoices: WorkspaceInvoice[];
  projects: Project[];
  tasks: TaskItem[];
  lead?: Lead | null;
  now?: Date;
}): ClientHealth {
  const today = (input.now ?? new Date()).toISOString().slice(0, 10);
  const overdueInvoice = input.invoices.find(
    (item) => !item.archived && item.status !== "paid" && item.status !== "void" && item.dueDate && item.dueDate < today,
  );
  if (overdueInvoice?.dueDate) {
    const days = daysBetween(overdueInvoice.dueDate, today);
    return {
      label: days >= 14 ? "At Risk" : "Needs Attention",
      tone: days >= 14 ? "danger" : "warning",
      reason: `Invoice ${overdueInvoice.invoiceNumber} is ${days} day${days === 1 ? "" : "s"} overdue.`,
    };
  }

  const overdueProject = input.projects.find(
    (item) => item.deadline && item.deadline < today && item.stage !== "completed" && item.stage !== "on_hold",
  );
  if (overdueProject?.deadline) {
    const days = daysBetween(overdueProject.deadline, today);
    return {
      label: "At Risk",
      tone: "danger",
      reason: `${overdueProject.name} is ${days} day${days === 1 ? "" : "s"} past deadline.`,
    };
  }

  const blocked = input.tasks.find((item) => item.status === "blocked");
  if (blocked) {
    return {
      label: "Needs Attention",
      tone: "warning",
      reason: `Waiting on client: ${blocked.title}.`,
    };
  }

  const followUp = input.lead?.nextFollowUp;
  if (followUp && followUp <= today && input.lead && input.lead.stage !== "won" && input.lead.stage !== "lost") {
    return {
      label: "Needs Attention",
      tone: "warning",
      reason: `Follow-up required for ${input.lead.businessName}.`,
    };
  }

  const upcoming = input.projects.find((item) => item.deadline && item.deadline >= today && item.deadline <= today);
  if (upcoming?.deadline) {
    return {
      label: "Needs Attention",
      tone: "warning",
      reason: `Upcoming deadline: ${upcoming.name} due ${upcoming.deadline}.`,
    };
  }

  const soon = input.projects
    .filter((item) => item.deadline && item.deadline > today)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
  if (soon?.deadline && daysBetween(today, soon.deadline) <= 7) {
    return {
      label: "Needs Attention",
      tone: "warning",
      reason: `Upcoming deadline: ${soon.name} due ${soon.deadline}.`,
    };
  }

  return {
    label: "Healthy",
    tone: "success",
    reason: "No overdue invoices, missed deadlines, or required follow-ups.",
  };
}

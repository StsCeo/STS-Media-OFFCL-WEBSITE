import type { CalendarEvent, Lead, Project, WorkspaceEstimate, WorkspaceInvoice } from "@/lib/types";

export type JourneyStatus = "complete" | "current" | "pending" | "future";

export type JourneyStep = {
  id: string;
  label: string;
  status: JourneyStatus;
  href?: string;
  detail?: string;
};

const DISCOVERY_STAGES = new Set([
  "discovery_scheduled",
  "discovery_completed",
  "proposal_sent",
  "negotiating",
  "won",
]);

export function deriveClientJourney(input: {
  lead?: Lead | null;
  estimates: WorkspaceEstimate[];
  invoices: WorkspaceInvoice[];
  projects: Project[];
  portalPublished: boolean;
  events?: CalendarEvent[];
}): JourneyStep[] {
  const lead = input.lead ?? null;
  const estimates = input.estimates.filter((item) => !item.archived);
  const invoices = input.invoices.filter((item) => !item.archived);
  const projects = input.projects;
  const sentEstimate = estimates.find((item) => item.status !== "draft") ?? estimates[0];
  const acceptedEstimate = estimates.find((item) => item.status === "accepted");
  const invoice = invoices[0];
  const paidInvoice = invoices.find((item) => item.status === "paid" || item.amountPaidCents >= item.totalCents);
  const project = projects[0];
  const projectStarted = projects.some((item) => item.stage !== "lead");
  const deliverables = projects.some((item) =>
    ["ready_to_launch", "launched", "maintenance", "completed"].includes(item.stage),
  );
  const discoveryDone = Boolean(
    lead && DISCOVERY_STAGES.has(lead.stage),
  ) || Boolean(input.events?.some((event) => event.kind === "client_meeting"));

  const steps: JourneyStep[] = [
    {
      id: "lead",
      label: "Lead Created",
      status: lead ? "complete" : "pending",
      href: lead ? `/dashboard/leads?lead=${lead.id}` : undefined,
      detail: lead?.businessName,
    },
    {
      id: "discovery",
      label: "Discovery",
      status: discoveryDone ? "complete" : lead ? "current" : "pending",
      href: lead ? `/dashboard/leads?lead=${lead.id}` : undefined,
    },
    {
      id: "estimate_sent",
      label: "Estimate Sent",
      status: sentEstimate && sentEstimate.status !== "draft" ? "complete" : estimates.length ? "current" : "pending",
      href: sentEstimate ? `/dashboard/estimates` : undefined,
      detail: sentEstimate?.estimateNumber,
    },
    {
      id: "estimate_accepted",
      label: "Estimate Accepted",
      status: acceptedEstimate ? "complete" : sentEstimate ? "current" : "pending",
      href: acceptedEstimate ? `/dashboard/estimates` : undefined,
    },
    {
      id: "invoice",
      label: "Invoice Created",
      status: invoice ? "complete" : "pending",
      href: invoice ? `/dashboard/invoices` : undefined,
      detail: invoice?.invoiceNumber,
    },
    {
      id: "payment",
      label: paidInvoice ? "Payment Received" : "Payment Pending",
      status: paidInvoice ? "complete" : invoice ? "current" : "pending",
      href: invoice ? `/dashboard/invoices` : undefined,
    },
    {
      id: "project",
      label: "Project Started",
      status: projectStarted ? "complete" : project ? "current" : "pending",
      href: project ? `/dashboard/projects/${project.id}` : undefined,
      detail: project?.name,
    },
    {
      id: "deliverables",
      label: "Deliverables",
      status: deliverables ? "complete" : projectStarted ? "current" : "pending",
      href: project ? `/dashboard/projects/${project.id}` : undefined,
    },
    {
      id: "portal",
      label: "Client Portal",
      status: input.portalPublished ? "complete" : "pending",
      href: "/dashboard/client-portal",
    },
    {
      id: "recurring",
      label: "Recurring Service",
      status: "future",
      detail: "Available in a later operations phase.",
    },
    {
      id: "testimonial",
      label: "Testimonial / Referral",
      status: "future",
      detail: "Available in a later operations phase.",
    },
  ];

  return steps;
}

import type { Lead, TaskItem } from "@/lib/types";

export const PUBLIC_INTAKE_RPC = "sts_capture_public_inquiry";
export const PUBLIC_INTAKE_ORGANIZATION_SLUG = "sts-media";
export const PUBLIC_INTAKE_FAILURE = "We could not save this inquiry. Please try again.";

export type PublicIntakeInput = {
  submissionKey: string;
  contactName: string;
  businessName: string;
  email: string;
  phone: string;
  service: string;
  audience: "owner" | "creator" | "both";
  budget: string;
  preferredContact: "email" | "phone" | "either";
  message: string;
};

export type PublicIntakeMemory = {
  leads: Lead[];
  tasks: TaskItem[];
};

type RpcResult = { data: unknown; error: { message: string } | null };

export function newYorkDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
}

export function publicIntakeRpcArgs(input: PublicIntakeInput) {
  return {
    p_submission_key: input.submissionKey,
    p_contact_name: input.contactName,
    p_business_name: input.businessName,
    p_email: input.email,
    p_phone: input.phone,
    p_service: input.service,
    p_audience: input.audience,
    p_budget: input.budget,
    p_preferred_contact: input.preferredContact,
    p_message: input.message,
  };
}

export function applyLocalPublicIntake(memory: PublicIntakeMemory, input: PublicIntakeInput, now = new Date()) {
  const leadId = `lead-${input.submissionKey}`;
  const taskId = `task-${input.submissionKey}`;
  if (memory.leads.some((lead) => lead.id === leadId) || memory.tasks.some((task) => task.id === taskId)) {
    return { ok: true as const, created: false };
  }

  const businessName = (input.businessName.trim() || input.contactName.trim()).slice(0, 160);
  const followUp = newYorkDate(now);
  memory.leads.unshift({
    id: leadId,
    businessName,
    contactName: input.contactName.trim(),
    email: input.email,
    phone: input.phone,
    source: "Contact form",
    requestedService: input.service,
    estimatedValue: 0,
    probability: 10,
    stage: "new_inquiry",
    lastContact: null,
    nextFollowUp: followUp,
    callsMade: 0,
    emailsSent: 0,
    meetings: 0,
    notes: `[Audience: ${input.audience}]\n${input.message}`.slice(0, 4000),
    assignedTo: "Owner",
    createdAt: followUp,
  });
  memory.tasks.unshift({
    id: taskId,
    title: `Follow up: ${businessName}`.slice(0, 160),
    projectId: null,
    clientId: null,
    dueDate: followUp,
    status: "todo",
    priority: "high",
    assignee: "Owner",
    notes: `Service: ${input.service}. Not booked. Not signed. Not paid.`,
  });
  return { ok: true as const, created: true };
}

export async function captureConfiguredIntake(
  rpc: (name: string, args: ReturnType<typeof publicIntakeRpcArgs>) => Promise<RpcResult>,
  input: PublicIntakeInput,
) {
  const args = publicIntakeRpcArgs(input);
  const { data, error } = await rpc(PUBLIC_INTAKE_RPC, args);
  if (error || !isAcceptedIntake(data)) {
    return { ok: false as const, error: PUBLIC_INTAKE_FAILURE };
  }
  return { ok: true as const };
}

function isAcceptedIntake(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const record = data as Record<string, unknown>;
  return record.ok === true && !("lead_id" in record) && !("task_id" in record) && !("organization_id" in record);
}

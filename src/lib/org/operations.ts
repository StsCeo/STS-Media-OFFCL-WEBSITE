import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/config";
import { dollarsToCents, centsToDollars } from "@/lib/money";
import { roundMoney } from "@/lib/utils";
import { sanitizeText } from "@/lib/validation";
import type { SessionUser } from "@/lib/auth/session";
import {
  PROJECT_STAGES,
  type Expense,
  type Project,
  type ProjectStage,
  type RevenueEntry,
  type TaskItem,
} from "@/lib/types";

export const EXPENSE_SAVE_RPC = "sts_save_ops_expense";
export const EXPENSE_ARCHIVE_RPC = "sts_archive_ops_expense";
export const REVENUE_SAVE_RPC = "sts_save_ops_revenue";
export const REVENUE_ARCHIVE_RPC = "sts_archive_ops_revenue";
export const PROJECT_SAVE_RPC = "sts_save_ops_project";
export const PROJECT_ARCHIVE_RPC = "sts_archive_ops_project";
export const TASK_SAVE_RPC = "sts_save_ops_task";
export const TASK_ARCHIVE_RPC = "sts_archive_ops_task";
export const GENERIC_OPS_ERROR = "The record could not be saved.";
export const OPS_ESTIMATE_NOTE =
  "Operational estimate for this organization. Not a formal accounting or tax report.";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPersistedOpsId(value: string | null | undefined): value is string {
  return Boolean(value && UUID_RE.test(value));
}

export function shouldUseOpsDatabase(user: SessionUser | null | undefined) {
  return Boolean(
    user?.source === "supabase" &&
      isSupabaseConfigured() &&
      user.organizationId &&
      user.membershipStatus === "active",
  );
}

function dateOrNull(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

function optionalUuid(value: string | null | undefined) {
  return isPersistedOpsId(value) ? value : null;
}

export function mapOpsExpenseRow(row: Record<string, unknown>): Expense {
  const pretax = centsToDollars(Number(row.pretax_cents || 0));
  const tax = centsToDollars(Number(row.tax_cents || 0));
  return {
    id: String(row.id),
    transactionDate: String(row.transaction_date),
    postedDate: String(row.posted_date),
    vendor: String(row.vendor),
    description: String(row.description),
    pretaxAmount: pretax,
    salesTax: tax,
    totalAmount: roundMoney(pretax + tax),
    currency: String(row.currency || "USD"),
    category: String(row.category),
    subcategory: String(row.subcategory || ""),
    clientId: (row.client_id as string | null) ?? null,
    projectId: (row.project_id as string | null) ?? null,
    businessPurpose: String(row.business_purpose || ""),
    paymentAccount: String(row.payment_account || ""),
    paymentMethod: String(row.payment_method || ""),
    recurring: Boolean(row.recurring),
    billingFrequency: (row.billing_frequency as Expense["billingFrequency"]) || "one_time",
    receiptName: (row.receipt_name as string | null) ?? null,
    receiptStatus: (row.receipt_status as Expense["receiptStatus"]) || "missing",
    reimbursable: Boolean(row.reimbursable),
    reimbursementStatus: (row.reimbursement_status as Expense["reimbursementStatus"]) || "n/a",
    directProjectCost: Boolean(row.direct_project_cost),
    taxReviewStatus: "needs_review",
    deductibilityStatus: "unknown",
    taxYear: Number(String(row.transaction_date).slice(0, 4)) || new Date().getFullYear(),
    notes: String(row.notes || ""),
    createdBy: String(row.created_by || "Owner"),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    archived: Boolean(row.archived_at),
    confirmationStatus: "confirmed",
    demoLabel: false,
  };
}

export function mapOpsRevenueRow(row: Record<string, unknown>): RevenueEntry {
  return {
    id: String(row.id),
    date: String(row.earned_date),
    type: (row.entry_type as RevenueEntry["type"]) || "one_time_project",
    description: String(row.description),
    amount: centsToDollars(Number(row.amount_cents || 0)),
    currency: String(row.currency || "USD"),
    clientId: (row.client_id as string | null) ?? null,
    projectId: (row.project_id as string | null) ?? null,
    service: String(row.source_label || ""),
    invoiceStatus: (row.invoice_status as RevenueEntry["invoiceStatus"]) || "draft",
    paymentStatus: (row.payment_status as RevenueEntry["paymentStatus"]) || "unpaid",
    dueDate: (row.due_date as string | null) ?? null,
    stripeCustomerId: "",
    stripeSubscriptionId: "",
    recognized: Boolean(row.recognized),
    notes: String(row.notes || ""),
    demoLabel: false,
  };
}

export function mapOpsProjectRow(row: Record<string, unknown>): Project {
  const stage = PROJECT_STAGES.includes(row.stage as ProjectStage) ? (row.stage as ProjectStage) : "lead";
  return {
    id: String(row.id),
    name: String(row.name),
    clientId: String(row.client_id || ""),
    packageId: null,
    stage,
    startDate: String(row.start_date || ""),
    deadline: String(row.due_date || ""),
    budget: centsToDollars(Number(row.budget_cents || 0)),
    amountInvoiced: centsToDollars(Number(row.amount_invoiced_cents || 0)),
    amountCollected: centsToDollars(Number(row.amount_collected_cents || 0)),
    directCost: centsToDollars(Number(row.direct_cost_cents || 0)),
    githubRepo: "",
    vercelProject: "",
    productionUrl: "",
    domain: "",
    maintenancePlan: "",
    credentialsReference: "Stored outside this system. Record only the location of the vault, never the secret.",
    notes: String(row.notes || row.description || ""),
    atRisk: Boolean(row.at_risk),
  };
}

export function mapOpsTaskRow(row: Record<string, unknown>): TaskItem {
  return {
    id: String(row.id),
    title: String(row.title),
    projectId: (row.project_id as string | null) ?? null,
    clientId: (row.client_id as string | null) ?? null,
    dueDate: (row.due_date as string | null) ?? null,
    status: (row.status as TaskItem["status"]) || "todo",
    priority: (row.priority as TaskItem["priority"]) || "medium",
    assignee: String(row.assigned_to || "Owner"),
    notes: String(row.notes || row.description || ""),
  };
}

export async function listOpsExpenses(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from("ops_expenses")
    .select("*")
    .eq("organization_id", organizationId)
    .order("transaction_date", { ascending: false });
  if (error) return { error: true as const };
  return (data ?? []).map((row) => mapOpsExpenseRow(row as Record<string, unknown>));
}

export async function listOpsRevenue(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from("ops_revenue")
    .select("*")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("earned_date", { ascending: false });
  if (error) return { error: true as const };
  return (data ?? []).map((row) => mapOpsRevenueRow(row as Record<string, unknown>));
}

export async function listOpsProjects(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from("ops_projects")
    .select("*")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });
  if (error) return { error: true as const };
  return (data ?? []).map((row) => mapOpsProjectRow(row as Record<string, unknown>));
}

export async function listOpsTasks(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from("ops_tasks")
    .select("*")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });
  if (error) return { error: true as const };
  return (data ?? []).map((row) => mapOpsTaskRow(row as Record<string, unknown>));
}

export async function loadOpsExpense(supabase: SupabaseClient, organizationId: string, id: string) {
  if (!isPersistedOpsId(id)) return null;
  const { data, error } = await supabase
    .from("ops_expenses")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapOpsExpenseRow(data as Record<string, unknown>);
}

export async function loadOpsRevenue(supabase: SupabaseClient, organizationId: string, id: string) {
  if (!isPersistedOpsId(id)) return null;
  const { data, error } = await supabase
    .from("ops_revenue")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapOpsRevenueRow(data as Record<string, unknown>);
}

export async function loadOpsProject(supabase: SupabaseClient, organizationId: string, id: string) {
  if (!isPersistedOpsId(id)) return null;
  const { data, error } = await supabase
    .from("ops_projects")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapOpsProjectRow(data as Record<string, unknown>);
}

export async function loadOpsTask(supabase: SupabaseClient, organizationId: string, id: string) {
  if (!isPersistedOpsId(id)) return null;
  const { data, error } = await supabase
    .from("ops_tasks")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapOpsTaskRow(data as Record<string, unknown>);
}

export function normalizeExpenseInput(input: Partial<Expense> & { id?: string }, current?: Expense | null): Expense {
  const merged = { ...(current ?? {}), ...input };
  const pretax = Number(merged.pretaxAmount || 0);
  const tax = Number(merged.salesTax || 0);
  const reimbursable = Boolean(merged.reimbursable);
  let reimbursementStatus = merged.reimbursementStatus || "n/a";
  if (!reimbursable) reimbursementStatus = "n/a";
  if (reimbursable && reimbursementStatus === "n/a") reimbursementStatus = "pending";
  return {
    id: merged.id || "",
    transactionDate: merged.transactionDate || new Date().toISOString().slice(0, 10),
    postedDate: merged.postedDate || merged.transactionDate || new Date().toISOString().slice(0, 10),
    vendor: sanitizeText(merged.vendor || "Add vendor"),
    description: sanitizeText(merged.description || "Add description"),
    pretaxAmount: pretax,
    salesTax: tax,
    totalAmount: roundMoney(pretax + tax),
    currency: merged.currency || "USD",
    category: merged.category || "Needs review",
    subcategory: sanitizeText(merged.subcategory || ""),
    clientId: merged.clientId ?? null,
    projectId: merged.projectId ?? null,
    businessPurpose: sanitizeText(merged.businessPurpose || ""),
    paymentAccount: sanitizeText(merged.paymentAccount || ""),
    paymentMethod: sanitizeText(merged.paymentMethod || ""),
    recurring: Boolean(merged.recurring),
    billingFrequency: merged.billingFrequency || "one_time",
    receiptName: merged.receiptName ?? null,
    receiptStatus: merged.receiptStatus || "missing",
    reimbursable,
    reimbursementStatus,
    directProjectCost: Boolean(merged.directProjectCost),
    taxReviewStatus: merged.taxReviewStatus || "needs_review",
    deductibilityStatus: merged.deductibilityStatus || "unknown",
    taxYear: merged.taxYear || new Date().getFullYear(),
    notes: sanitizeText(merged.notes || ""),
    createdBy: merged.createdBy || "Owner",
    createdAt: merged.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    archived: Boolean(merged.archived),
    confirmationStatus: merged.confirmationStatus || "draft",
    demoLabel: Boolean(merged.demoLabel),
  };
}

export async function saveOpsExpenseInDatabase(
  supabase: SupabaseClient,
  organizationId: string,
  input: Expense,
) {
  const { data, error } = await supabase.rpc(EXPENSE_SAVE_RPC, {
    p_organization_id: organizationId,
    p_id: isPersistedOpsId(input.id) ? input.id : null,
    p_transaction_date: input.transactionDate,
    p_posted_date: input.postedDate,
    p_vendor: input.vendor,
    p_description: input.description,
    p_pretax_cents: Math.max(0, dollarsToCents(input.pretaxAmount)),
    p_tax_cents: Math.max(0, dollarsToCents(input.salesTax)),
    p_currency: input.currency || "USD",
    p_category: input.category,
    p_subcategory: input.subcategory,
    p_client_id: optionalUuid(input.clientId),
    p_project_id: optionalUuid(input.projectId),
    p_business_purpose: input.businessPurpose,
    p_payment_account: input.paymentAccount,
    p_payment_method: input.paymentMethod,
    p_recurring: input.recurring,
    p_billing_frequency: input.billingFrequency,
    p_receipt_name: input.receiptName,
    p_receipt_status: input.receiptStatus,
    p_reimbursable: input.reimbursable,
    p_reimbursement_status: input.reimbursementStatus,
    p_direct_project_cost: input.directProjectCost,
    p_notes: input.notes,
  });
  if (error || !data) return { error: true as const };
  return { id: String(data) };
}

export async function archiveOpsExpenseInDatabase(
  supabase: SupabaseClient,
  organizationId: string,
  id: string,
) {
  const { data, error } = await supabase.rpc(EXPENSE_ARCHIVE_RPC, {
    p_organization_id: organizationId,
    p_id: id,
  });
  if (error || !data) return { error: true as const };
  return { id: String(data) };
}

export function normalizeRevenueInput(input: Partial<RevenueEntry> & { id?: string }, current?: RevenueEntry | null): RevenueEntry {
  const merged = { ...(current ?? {}), ...input };
  const paymentStatus = merged.paymentStatus || "unpaid";
  return {
    id: merged.id || "",
    date: merged.date || new Date().toISOString().slice(0, 10),
    type: merged.type || "one_time_project",
    description: sanitizeText(merged.description || "Add description"),
    amount: Number(merged.amount || 0),
    currency: merged.currency || "USD",
    clientId: merged.clientId ?? null,
    projectId: merged.projectId ?? null,
    service: sanitizeText(merged.service || ""),
    invoiceStatus: merged.invoiceStatus || "draft",
    paymentStatus,
    dueDate: merged.dueDate ?? null,
    stripeCustomerId: "",
    stripeSubscriptionId: "",
    recognized: Boolean(merged.recognized),
    notes: sanitizeText(merged.notes || ""),
    demoLabel: false,
  };
}

export async function saveOpsRevenueInDatabase(
  supabase: SupabaseClient,
  organizationId: string,
  input: RevenueEntry,
  extras?: { paymentMethod?: string; paidDate?: string | null; invoiceNumber?: string; recurring?: boolean },
) {
  const paid = input.paymentStatus === "paid";
  const { data, error } = await supabase.rpc(REVENUE_SAVE_RPC, {
    p_organization_id: organizationId,
    p_id: isPersistedOpsId(input.id) ? input.id : null,
    p_client_id: optionalUuid(input.clientId),
    p_project_id: optionalUuid(input.projectId),
    p_source_label: input.service,
    p_description: input.description,
    p_amount_cents: Math.max(0, dollarsToCents(input.amount)),
    p_currency: input.currency || "USD",
    p_invoice_number: extras?.invoiceNumber || "",
    p_entry_type: input.type,
    p_earned_date: input.date,
    p_due_date: dateOrNull(input.dueDate),
    p_paid_date: paid ? dateOrNull(extras?.paidDate) || input.date : dateOrNull(extras?.paidDate),
    p_invoice_status: input.invoiceStatus,
    p_payment_status: input.paymentStatus,
    p_payment_method: paid ? (extras?.paymentMethod || "Recorded") : (extras?.paymentMethod || ""),
    p_recurring: Boolean(extras?.recurring || input.type === "recurring_maintenance"),
    p_recognized: input.recognized,
    p_notes: input.notes,
  });
  if (error || !data) return { error: true as const };
  return { id: String(data) };
}

export async function archiveOpsRevenueInDatabase(
  supabase: SupabaseClient,
  organizationId: string,
  id: string,
) {
  const { data, error } = await supabase.rpc(REVENUE_ARCHIVE_RPC, {
    p_organization_id: organizationId,
    p_id: id,
  });
  if (error || !data) return { error: true as const };
  return { id: String(data) };
}

export async function saveOpsProjectInDatabase(
  supabase: SupabaseClient,
  organizationId: string,
  input: Project,
) {
  const { data, error } = await supabase.rpc(PROJECT_SAVE_RPC, {
    p_organization_id: organizationId,
    p_id: isPersistedOpsId(input.id) ? input.id : null,
    p_client_id: optionalUuid(input.clientId),
    p_name: input.name,
    p_description: input.notes,
    p_stage: input.stage,
    p_priority: "medium",
    p_start_date: dateOrNull(input.startDate),
    p_due_date: dateOrNull(input.deadline),
    p_budget_cents: Math.max(0, dollarsToCents(input.budget)),
    p_assigned_member_id: null,
    p_assigned_to: "Owner",
    p_at_risk: input.atRisk,
    p_notes: input.notes,
  });
  if (error || !data) return { error: true as const };
  return { id: String(data) };
}

export async function archiveOpsProjectInDatabase(
  supabase: SupabaseClient,
  organizationId: string,
  id: string,
) {
  const { data, error } = await supabase.rpc(PROJECT_ARCHIVE_RPC, {
    p_organization_id: organizationId,
    p_id: id,
  });
  if (error || !data) return { error: true as const };
  return { id: String(data) };
}

export async function saveOpsTaskInDatabase(
  supabase: SupabaseClient,
  organizationId: string,
  input: TaskItem,
) {
  const { data, error } = await supabase.rpc(TASK_SAVE_RPC, {
    p_organization_id: organizationId,
    p_id: isPersistedOpsId(input.id) ? input.id : null,
    p_project_id: optionalUuid(input.projectId),
    p_client_id: optionalUuid(input.clientId),
    p_title: input.title,
    p_description: input.notes,
    p_status: input.status,
    p_priority: input.priority,
    p_due_date: dateOrNull(input.dueDate),
    p_assigned_member_id: null,
    p_assigned_to: input.assignee,
    p_notes: input.notes,
  });
  if (error || !data) return { error: true as const };
  return { id: String(data) };
}

export async function archiveOpsTaskInDatabase(
  supabase: SupabaseClient,
  organizationId: string,
  id: string,
) {
  const { data, error } = await supabase.rpc(TASK_ARCHIVE_RPC, {
    p_organization_id: organizationId,
    p_id: id,
  });
  if (error || !data) return { error: true as const };
  return { id: String(data) };
}

export function operationalTotals(input: {
  expenses: Expense[];
  revenue: RevenueEntry[];
  projects: Project[];
  tasks: TaskItem[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  const liveExpenses = input.expenses.filter((item) => !item.archived);
  const liveRevenue = input.revenue;
  const totalExpenses = roundMoney(liveExpenses.reduce((sum, item) => sum + item.totalAmount, 0));
  const totalRevenue = roundMoney(
    liveRevenue
      .filter((item) => item.paymentStatus === "paid" && item.type !== "refund")
      .reduce((sum, item) => sum + item.amount, 0),
  );
  const outstandingRevenue = roundMoney(
    liveRevenue
      .filter((item) => item.paymentStatus === "unpaid" || item.paymentStatus === "pending")
      .reduce((sum, item) => sum + item.amount, 0),
  );
  const unreimbursed = roundMoney(
    liveExpenses
      .filter((item) => item.reimbursable && item.reimbursementStatus !== "reimbursed")
      .reduce((sum, item) => sum + item.totalAmount, 0),
  );
  const activeProjects = input.projects.filter((item) => item.stage !== "completed").length;
  const openTasks = input.tasks.filter((item) => item.status !== "done").length;
  const overdueTasks = input.tasks.filter(
    (item) => item.status !== "done" && item.dueDate && item.dueDate < today,
  ).length;
  return {
    totalRevenue,
    totalExpenses,
    netIncome: roundMoney(totalRevenue - totalExpenses),
    outstandingRevenue,
    unreimbursedExpenses: unreimbursed,
    activeProjects,
    openTasks,
    overdueTasks,
  };
}

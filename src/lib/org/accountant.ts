import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServer, getSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/data/store";
import { dollarsToCents } from "@/lib/money";
import {
  ACCOUNTANT_ARCHIVE_NOTE,
  ACCOUNTANT_RECORD_NOTE,
  ACCOUNTANT_REVENUE_NOTE,
  accountantOverview,
  mapAccountantAuditRow,
  mapAccountantExpenseRow,
  mapAccountantInvoiceRow,
  mapAccountantRevenueRow,
  type AccountantAuditRow,
  type AccountantExpenseRow,
  type AccountantInvoiceRow,
  type AccountantRevenueRow,
} from "@/lib/org/accountant-model";
import { shouldUseOpsDatabase } from "@/lib/org/operations";

export const ACCOUNTANT_INVOICES_VIEW = "sts_accountant_invoices";
export const ACCOUNTANT_EXPENSES_VIEW = "sts_accountant_expenses";
export const ACCOUNTANT_REVENUE_VIEW = "sts_accountant_revenue";
export const ACCOUNTANT_AUDIT_RPC = "sts_list_accountant_finance_audit";
export const ACCOUNTANT_EXPORT_RPC = "sts_record_accountant_export";

function emptyOverview() {
  return accountantOverview({ invoices: [], expenses: [], revenue: [] });
}

function fromDemoWorkspace() {
  const workspace = getWorkspace();
  const invoices = workspace.workspaceInvoices.map((invoice) =>
    mapAccountantInvoiceRow({
      id: invoice.id,
      invoice_number: invoice.invoiceNumber,
      status: invoice.status,
      issue_date: invoice.issueDate,
      due_date: invoice.dueDate,
      currency: invoice.currency,
      client_business_name: invoice.clientBusinessName,
      subtotal_cents: invoice.subtotalCents,
      tax_cents: invoice.taxCents,
      total_cents: invoice.totalCents,
      amount_paid_cents: invoice.amountPaidCents,
      paid_at: invoice.paidAt,
      archived_at: invoice.archived ? invoice.updatedAt : null,
    }),
  );
  const expenses = workspace.expenses.map((expense) =>
    mapAccountantExpenseRow({
      id: expense.id,
      transaction_date: expense.transactionDate,
      vendor: expense.vendor,
      description: expense.description,
      category: expense.category,
      currency: expense.currency,
      total_cents: dollarsToCents(expense.totalAmount),
      reimbursable: expense.reimbursable,
      reimbursement_status: expense.reimbursementStatus,
      archived_at: expense.archived ? expense.updatedAt : null,
    }),
  );
  const revenue = workspace.revenue.map((entry) =>
    mapAccountantRevenueRow({
      id: entry.id,
      earned_date: entry.date,
      entry_type: entry.type,
      description: entry.description,
      invoice_number: "",
      currency: entry.currency,
      amount_cents: dollarsToCents(entry.amount),
      payment_status: entry.paymentStatus,
      archived_at: null,
    }),
  );
  return { invoices, expenses, revenue };
}

export async function listAccountantInvoices(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from(ACCOUNTANT_INVOICES_VIEW)
    .select(
      "id,invoice_number,status,issue_date,due_date,currency,client_business_name,subtotal_cents,tax_cents,total_cents,amount_paid_cents,paid_at,archived_at",
    )
    .eq("organization_id", organizationId)
    .order("issue_date", { ascending: false });
  if (error) return { error: true as const };
  return (data ?? []).map((row) => mapAccountantInvoiceRow(row as Record<string, unknown>));
}

export async function listAccountantExpenses(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from(ACCOUNTANT_EXPENSES_VIEW)
    .select(
      "id,transaction_date,vendor,description,category,currency,total_cents,reimbursable,reimbursement_status,archived_at",
    )
    .eq("organization_id", organizationId)
    .order("transaction_date", { ascending: false });
  if (error) return { error: true as const };
  return (data ?? []).map((row) => mapAccountantExpenseRow(row as Record<string, unknown>));
}

export async function listAccountantRevenue(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from(ACCOUNTANT_REVENUE_VIEW)
    .select(
      "id,earned_date,entry_type,description,invoice_number,currency,amount_cents,payment_status,archived_at",
    )
    .eq("organization_id", organizationId)
    .order("earned_date", { ascending: false });
  if (error) return { error: true as const };
  return (data ?? []).map((row) => mapAccountantRevenueRow(row as Record<string, unknown>));
}

export async function listAccountantFinanceAudit(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc(ACCOUNTANT_AUDIT_RPC);
  if (error) return { error: true as const };
  return (data ?? []).map((row) => mapAccountantAuditRow(row as Record<string, unknown>));
}

export async function recordAccountantExport(
  supabase: SupabaseClient,
  exportType: "invoices" | "revenue" | "expenses",
  rowCount: number,
) {
  const { error } = await supabase.rpc(ACCOUNTANT_EXPORT_RPC, {
    p_export_type: exportType,
    p_row_count: rowCount,
  });
  return !error;
}

export async function loadAccountantCenter(): Promise<{
  invoices: AccountantInvoiceRow[];
  expenses: AccountantExpenseRow[];
  revenue: AccountantRevenueRow[];
  audit: AccountantAuditRow[];
  overview: ReturnType<typeof accountantOverview>;
  source: "postgres" | "demo-memory";
  unavailable: boolean;
  recordNote: string;
  revenueNote: string;
  archiveNote: string;
}> {
  const session = await getSession();
  const notes = {
    recordNote: ACCOUNTANT_RECORD_NOTE,
    revenueNote: ACCOUNTANT_REVENUE_NOTE,
    archiveNote: ACCOUNTANT_ARCHIVE_NOTE,
  };
  if (!session.user?.mfaVerified && session.user?.source !== "demo") {
    return {
      invoices: [],
      expenses: [],
      revenue: [],
      audit: [],
      overview: emptyOverview(),
      source: "postgres",
      unavailable: true,
      ...notes,
    };
  }
  if (!shouldUseOpsDatabase(session.user) || !session.user?.organizationId) {
    const demo = fromDemoWorkspace();
    return {
      ...demo,
      audit: [],
      overview: accountantOverview(demo),
      source: "demo-memory",
      unavailable: false,
      ...notes,
    };
  }

  const factory = createSupabaseServer();
  if (!factory) {
    return {
      invoices: [],
      expenses: [],
      revenue: [],
      audit: [],
      overview: emptyOverview(),
      source: "postgres",
      unavailable: true,
      ...notes,
    };
  }

  const supabase = await factory();
  const organizationId = session.user.organizationId;
  const [invoices, expenses, revenue, audit] = await Promise.all([
    listAccountantInvoices(supabase, organizationId),
    listAccountantExpenses(supabase, organizationId),
    listAccountantRevenue(supabase, organizationId),
    listAccountantFinanceAudit(supabase),
  ]);
  if (
    "error" in (invoices as { error?: true }) ||
    "error" in (expenses as { error?: true }) ||
    "error" in (revenue as { error?: true })
  ) {
    return {
      invoices: [],
      expenses: [],
      revenue: [],
      audit: [],
      overview: emptyOverview(),
      source: "postgres",
      unavailable: true,
      ...notes,
    };
  }
  const safeInvoices = invoices as AccountantInvoiceRow[];
  const safeExpenses = expenses as AccountantExpenseRow[];
  const safeRevenue = revenue as AccountantRevenueRow[];
  return {
    invoices: safeInvoices,
    expenses: safeExpenses,
    revenue: safeRevenue,
    audit: "error" in (audit as { error?: true }) ? [] : (audit as AccountantAuditRow[]),
    overview: accountantOverview({
      invoices: safeInvoices,
      expenses: safeExpenses,
      revenue: safeRevenue,
    }),
    source: "postgres",
    unavailable: false,
    ...notes,
  };
}

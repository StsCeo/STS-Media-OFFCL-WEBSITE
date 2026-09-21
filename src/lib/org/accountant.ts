import type { SupabaseClient } from "@supabase/supabase-js";
import { canAccessAccountantCenter, createSupabaseServer, getSession } from "@/lib/auth/session";
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

export const ACCOUNTANT_INVOICES_RPC = "sts_list_accountant_invoices";
export const ACCOUNTANT_EXPENSES_RPC = "sts_list_accountant_expenses";
export const ACCOUNTANT_REVENUE_RPC = "sts_list_accountant_revenue";
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

export async function listAccountantInvoices(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc(ACCOUNTANT_INVOICES_RPC);
  if (error) return { error: true as const };
  return (data ?? []).map((row) => mapAccountantInvoiceRow(row as Record<string, unknown>));
}

export async function listAccountantExpenses(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc(ACCOUNTANT_EXPENSES_RPC);
  if (error) return { error: true as const };
  return (data ?? []).map((row) => mapAccountantExpenseRow(row as Record<string, unknown>));
}

export async function listAccountantRevenue(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc(ACCOUNTANT_REVENUE_RPC);
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
  if (!canAccessAccountantCenter(session.user)) {
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
  const [invoices, expenses, revenue, audit] = await Promise.all([
    listAccountantInvoices(supabase),
    listAccountantExpenses(supabase),
    listAccountantRevenue(supabase),
    listAccountantFinanceAudit(supabase),
  ]);
  if (
    "error" in invoices ||
    "error" in expenses ||
    "error" in revenue
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
  return {
    invoices,
    expenses,
    revenue,
    audit: "error" in audit ? [] : audit,
    overview: accountantOverview({
      invoices,
      expenses,
      revenue,
    }),
    source: "postgres",
    unavailable: false,
    ...notes,
  };
}

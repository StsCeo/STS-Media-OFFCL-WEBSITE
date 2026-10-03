import { centsToDollars } from "@/lib/money";
import { derivedInvoiceStatus } from "@/lib/org/workspace-model";
import type { WorkspaceInvoiceStatus } from "@/lib/types";
import { roundMoney } from "@/lib/utils";

export const ACCOUNTANT_EXPORT_TYPES = ["invoices", "revenue", "expenses"] as const;
export type AccountantExportType = (typeof ACCOUNTANT_EXPORT_TYPES)[number];

export const ACCOUNTANT_RECORD_NOTE =
  "These are operational records for this organization. They are not tax returns, tax advice, audited financial statements, or bank balances.";
export const ACCOUNTANT_REVENUE_NOTE =
  "Estimates and quotes are not recognized revenue. Paid revenue counts only non-archived operational revenue marked paid, excluding refunds.";
export const ACCOUNTANT_ARCHIVE_NOTE =
  "Headline totals exclude archived rows. Archived invoices, revenue, and expenses stay in the lists and exports and are labeled Archived.";
export const ACCOUNTANT_READONLY_NOTE =
  "Accountant Center is strictly read-only. Create, edit, status-change, archive, restore, delete, convert, reconcile, and payment controls are not available here.";

export type AccountantInvoiceRow = {
  id: string;
  invoiceNumber: string;
  status: string;
  derivedStatus: string;
  issueDate: string | null;
  dueDate: string | null;
  paidAt: string | null;
  currency: string;
  clientBusinessName: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  amountPaidCents: number;
  archived: boolean;
};

export type AccountantExpenseRow = {
  id: string;
  transactionDate: string;
  vendor: string;
  description: string;
  category: string;
  currency: string;
  totalCents: number;
  reimbursable: boolean;
  reimbursementStatus: string;
  archived: boolean;
};

export type AccountantRevenueRow = {
  id: string;
  earnedDate: string;
  entryType: string;
  description: string;
  invoiceNumber: string;
  currency: string;
  amountCents: number;
  paymentStatus: string;
  archived: boolean;
};

export type AccountantAuditRow = {
  occurredAt: string;
  action: string;
  entityType: string;
  result: string;
};

export type AccountantMonthRow = {
  month: string;
  paidRevenue: number;
  outstandingRevenue: number;
  expenses: number;
  unreimbursedExpenses: number;
};

export function isAccountantExportType(value: string | null | undefined): value is AccountantExportType {
  return Boolean(value && (ACCOUNTANT_EXPORT_TYPES as readonly string[]).includes(value));
}

export function accountantExportFilename(type: AccountantExportType, now = new Date()) {
  const stamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `sts-accountant-${type}-${stamp}.csv`;
}

function formulaUnsafe(value: string) {
  return /^[=+\-@]/.test(value);
}

export function escapeAccountantCsvValue(value: string | number | boolean | null | undefined) {
  let text = value == null ? "" : String(value);
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (formulaUnsafe(text)) {
    text = `'${text}`;
  }
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function accountantCsvDocument(headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>) {
  const lines = [
    headers.map((header) => escapeAccountantCsvValue(header)).join(","),
    ...rows.map((row) => row.map((cell) => escapeAccountantCsvValue(cell)).join(",")),
  ];
  return `${lines.join("\r\n")}\r\n`;
}

function asInvoiceStatus(value: string): WorkspaceInvoiceStatus {
  if (value === "issued" || value === "paid" || value === "void") return value;
  return "draft";
}

export function mapAccountantInvoiceRow(row: Record<string, unknown>, today = new Date().toISOString().slice(0, 10)): AccountantInvoiceRow {
  const status = asInvoiceStatus(String(row.status || "draft"));
  const dueDate = row.due_date ? String(row.due_date) : null;
  const archived = Boolean(row.archived_at);
  return {
    id: String(row.id),
    invoiceNumber: String(row.invoice_number || ""),
    status,
    derivedStatus: derivedInvoiceStatus({ status, dueDate: dueDate || "", archived }, today),
    issueDate: row.issue_date ? String(row.issue_date) : null,
    dueDate,
    paidAt: row.paid_at ? String(row.paid_at) : null,
    currency: String(row.currency || "USD"),
    clientBusinessName: String(row.client_business_name || ""),
    subtotalCents: Number(row.subtotal_cents || 0),
    taxCents: Number(row.tax_cents || 0),
    totalCents: Number(row.total_cents || 0),
    amountPaidCents: Number(row.amount_paid_cents || 0),
    archived,
  };
}

export function mapAccountantExpenseRow(row: Record<string, unknown>): AccountantExpenseRow {
  return {
    id: String(row.id),
    transactionDate: String(row.transaction_date || ""),
    vendor: String(row.vendor || ""),
    description: String(row.description || ""),
    category: String(row.category || ""),
    currency: String(row.currency || "USD"),
    totalCents: Number(row.total_cents || 0),
    reimbursable: Boolean(row.reimbursable),
    reimbursementStatus: String(row.reimbursement_status || "n/a"),
    archived: Boolean(row.archived_at),
  };
}

export function mapAccountantRevenueRow(row: Record<string, unknown>): AccountantRevenueRow {
  return {
    id: String(row.id),
    earnedDate: String(row.earned_date || ""),
    entryType: String(row.entry_type || ""),
    description: String(row.description || ""),
    invoiceNumber: String(row.invoice_number || ""),
    currency: String(row.currency || "USD"),
    amountCents: Number(row.amount_cents || 0),
    paymentStatus: String(row.payment_status || "unpaid"),
    archived: Boolean(row.archived_at),
  };
}

export function mapAccountantAuditRow(row: Record<string, unknown>): AccountantAuditRow {
  return {
    occurredAt: String(row.occurred_at || row.created_at || ""),
    action: String(row.action || ""),
    entityType: String(row.entity_type || ""),
    result: String(row.result || ""),
  };
}

function monthKey(value: string | null | undefined) {
  const text = String(value || "").slice(0, 7);
  return /^\d{4}-\d{2}$/.test(text) ? text : "";
}

export function accountantOverview(input: {
  invoices: AccountantInvoiceRow[];
  expenses: AccountantExpenseRow[];
  revenue: AccountantRevenueRow[];
  today?: string;
}) {
  const liveRevenue = input.revenue.filter((item) => !item.archived);
  const liveExpenses = input.expenses.filter((item) => !item.archived);
  const liveInvoices = input.invoices.filter((item) => !item.archived);
  const paidRevenueCents = liveRevenue
    .filter((item) => item.paymentStatus === "paid" && item.entryType !== "refund")
    .reduce((sum, item) => sum + item.amountCents, 0);
  const outstandingRevenueCents = liveRevenue
    .filter((item) => item.paymentStatus === "unpaid" || item.paymentStatus === "pending")
    .reduce((sum, item) => sum + item.amountCents, 0);
  const expenseCents = liveExpenses.reduce((sum, item) => sum + item.totalCents, 0);
  const unreimbursedCents = liveExpenses
    .filter((item) => item.reimbursable && item.reimbursementStatus !== "reimbursed")
    .reduce((sum, item) => sum + item.totalCents, 0);
  const draftInvoiceCents = liveInvoices
    .filter((item) => item.derivedStatus === "draft")
    .reduce((sum, item) => sum + item.totalCents, 0);
  const openInvoiceCents = liveInvoices
    .filter((item) => item.derivedStatus === "issued")
    .reduce((sum, item) => sum + item.totalCents, 0);
  const overdueInvoiceCents = liveInvoices
    .filter((item) => item.derivedStatus === "overdue")
    .reduce((sum, item) => sum + item.totalCents, 0);
  const paidInvoiceCents = liveInvoices
    .filter((item) => item.derivedStatus === "paid")
    .reduce((sum, item) => sum + item.amountPaidCents, 0);

  const months = new Map<string, AccountantMonthRow>();
  const ensureMonth = (key: string) => {
    if (!key) return null;
    const existing = months.get(key);
    if (existing) return existing;
    const created: AccountantMonthRow = {
      month: key,
      paidRevenue: 0,
      outstandingRevenue: 0,
      expenses: 0,
      unreimbursedExpenses: 0,
    };
    months.set(key, created);
    return created;
  };
  for (const item of liveRevenue) {
    const month = ensureMonth(monthKey(item.earnedDate));
    if (!month) continue;
    if (item.paymentStatus === "paid" && item.entryType !== "refund") {
      month.paidRevenue = roundMoney(month.paidRevenue + centsToDollars(item.amountCents));
    }
    if (item.paymentStatus === "unpaid" || item.paymentStatus === "pending") {
      month.outstandingRevenue = roundMoney(month.outstandingRevenue + centsToDollars(item.amountCents));
    }
  }
  for (const item of liveExpenses) {
    const month = ensureMonth(monthKey(item.transactionDate));
    if (!month) continue;
    month.expenses = roundMoney(month.expenses + centsToDollars(item.totalCents));
    if (item.reimbursable && item.reimbursementStatus !== "reimbursed") {
      month.unreimbursedExpenses = roundMoney(month.unreimbursedExpenses + centsToDollars(item.totalCents));
    }
  }

  return {
    paidRevenue: centsToDollars(paidRevenueCents),
    outstandingRevenue: centsToDollars(outstandingRevenueCents),
    expenses: centsToDollars(expenseCents),
    unreimbursedExpenses: centsToDollars(unreimbursedCents),
    netIncome: roundMoney(centsToDollars(paidRevenueCents) - centsToDollars(expenseCents)),
    invoiceDraftTotal: centsToDollars(draftInvoiceCents),
    invoiceOpenTotal: centsToDollars(openInvoiceCents),
    invoiceOverdueTotal: centsToDollars(overdueInvoiceCents),
    invoicePaidTotal: centsToDollars(paidInvoiceCents),
    monthly: [...months.values()].sort((a, b) => b.month.localeCompare(a.month)),
    archivedInvoiceCount: input.invoices.filter((item) => item.archived).length,
    archivedExpenseCount: input.expenses.filter((item) => item.archived).length,
    archivedRevenueCount: input.revenue.filter((item) => item.archived).length,
  };
}

export function invoicesCsv(invoices: AccountantInvoiceRow[]) {
  return accountantCsvDocument(
    ["invoice_number", "status", "issue_date", "due_date", "client_business_name", "total", "currency", "archived"],
    invoices.map((item) => [
      item.invoiceNumber,
      item.derivedStatus,
      item.issueDate,
      item.dueDate,
      item.clientBusinessName,
      centsToDollars(item.totalCents).toFixed(2),
      item.currency,
      item.archived ? "archived" : "live",
    ]),
  );
}

export function revenueCsv(revenue: AccountantRevenueRow[]) {
  return accountantCsvDocument(
    ["earned_date", "entry_type", "description", "invoice_number", "amount", "payment_status", "currency", "archived"],
    revenue.map((item) => [
      item.earnedDate,
      item.entryType,
      item.description,
      item.invoiceNumber,
      centsToDollars(item.amountCents).toFixed(2),
      item.paymentStatus,
      item.currency,
      item.archived ? "archived" : "live",
    ]),
  );
}

export function expensesCsv(expenses: AccountantExpenseRow[]) {
  return accountantCsvDocument(
    ["transaction_date", "vendor", "category", "description", "amount", "reimbursement_status", "currency", "archived"],
    expenses.map((item) => [
      item.transactionDate,
      item.vendor,
      item.category,
      item.description,
      centsToDollars(item.totalCents).toFixed(2),
      item.reimbursementStatus,
      item.currency,
      item.archived ? "archived" : "live",
    ]),
  );
}

export function buildAccountantExportCsv(type: AccountantExportType, input: {
  invoices: AccountantInvoiceRow[];
  expenses: AccountantExpenseRow[];
  revenue: AccountantRevenueRow[];
}) {
  if (type === "invoices") return { csv: invoicesCsv(input.invoices), rowCount: input.invoices.length };
  if (type === "revenue") return { csv: revenueCsv(input.revenue), rowCount: input.revenue.length };
  return { csv: expensesCsv(input.expenses), rowCount: input.expenses.length };
}

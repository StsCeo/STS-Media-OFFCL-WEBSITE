import { dollarsToCents } from "./money";
import type { OsTransaction, WorkspaceState } from "./types";

export interface MasterTransactionRow {
  id: string;
  date: string;
  kind: OsTransaction["kind"] | "income" | "expense";
  source: OsTransaction["source"];
  description: string;
  amountCents: number;
  currency: string;
  status: string;
  category: string;
  notes: string;
}

export function buildMasterTransactionLog(workspace: WorkspaceState): MasterTransactionRow[] {
  const expenses: MasterTransactionRow[] = workspace.expenses
    .filter((item) => !item.archived)
    .map((item) => ({
      id: `expense:${item.id}`,
      date: item.transactionDate,
      kind: "expense",
      source: "expense_ledger",
      description: `${item.vendor} — ${item.description}`,
      amountCents: -Math.abs(dollarsToCents(item.totalAmount)),
      currency: item.currency || workspace.businessProfile.currency,
      status: item.confirmationStatus,
      category: item.category,
      notes: item.notes,
    }));

  const revenue: MasterTransactionRow[] = workspace.revenue.map((item) => ({
    id: `revenue:${item.id}`,
    date: item.date,
    kind: "income",
    source: "revenue_ledger",
    description: item.description,
    amountCents: dollarsToCents(item.type === "refund" ? -Math.abs(item.amount) : item.amount),
    currency: item.currency || workspace.businessProfile.currency,
    status: item.paymentStatus,
    category: item.service || item.type,
    notes: item.notes,
  }));

  const manual: MasterTransactionRow[] = workspace.osTransactions
    .filter((item) => !item.archived)
    .map((item) => ({
      id: item.id,
      date: item.date,
      kind: item.kind,
      source: item.source,
      description: item.description,
      amountCents: item.amountCents,
      currency: item.currency,
      status: "posted",
      category: item.category,
      notes: item.notes,
    }));

  return [...expenses, ...revenue, ...manual].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

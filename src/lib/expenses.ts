import type { Expense } from "./types";

export type ExpenseLedgerView = "all" | "missing" | "draft";

export function parseExpenseLedgerView(value: string | string[] | undefined | null): ExpenseLedgerView {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "missing" || raw === "draft") return raw;
  return "all";
}

export function expensesForLedgerView(expenses: Expense[], view: ExpenseLedgerView) {
  return expenses
    .filter((item) => !item.archived)
    .filter((item) => (view === "missing" ? item.receiptStatus === "missing" : true))
    .filter((item) => (view === "draft" ? item.confirmationStatus === "draft" : true));
}

export const STORAGE_NOT_CONFIGURED_MESSAGE =
  "Not configured. Receipt files cannot be stored until private object storage is connected.";

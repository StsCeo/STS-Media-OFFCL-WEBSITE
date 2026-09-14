import type { Expense, FileRecord, WorkspaceState } from "./types";
import { STORAGE_NOT_CONFIGURED_MESSAGE } from "./expenses";
import { safeUploadFileName } from "./security/files";

export { STORAGE_NOT_CONFIGURED_MESSAGE };

export function receiptFileRecord(expenseId: string, fileName: string, uploadedAt = new Date().toISOString()): FileRecord {
  return {
    id: `receipt-${uploadedAt}`,
    name: safeUploadFileName(fileName),
    kind: "receipt",
    relatedTo: expenseId,
    visibility: "private",
    uploadedAt,
  };
}

export function applyPrivateReceiptAttachment(state: WorkspaceState, expenseId: string, fileName: string, now = new Date().toISOString()) {
  const expense = state.expenses.find((item) => item.id === expenseId);
  if (!expense) return false;
  expense.receiptName = safeUploadFileName(fileName);
  expense.receiptStatus = "attached";
  expense.updatedAt = now;
  state.files.unshift(receiptFileRecord(expenseId, fileName, now));
  return true;
}

export function receiptIsPrivate(file: FileRecord) {
  return file.kind !== "receipt" || file.visibility === "private";
}

export function missingReceiptExpenses(expenses: Expense[]) {
  return expenses.filter((item) => !item.archived && item.receiptStatus === "missing");
}

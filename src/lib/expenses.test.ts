import { describe, expect, it } from "vitest";
import { createSeedWorkspace } from "./data/seed";
import { expensesForLedgerView, parseExpenseLedgerView } from "./expenses";
import { applyPrivateReceiptAttachment, missingReceiptExpenses, receiptIsPrivate, STORAGE_NOT_CONFIGURED_MESSAGE } from "./receipts";
import { allowedFile, uploadFileError } from "./security/files";

describe("expense missing-receipt view", () => {
  it("parses view=missing and returns only expenses without receipts", () => {
    expect(parseExpenseLedgerView("missing")).toBe("missing");
    const workspace = createSeedWorkspace();
    workspace.expenses[0].receiptStatus = "attached";
    workspace.expenses[0].receiptName = "georgia.pdf";
    const missing = expensesForLedgerView(workspace.expenses, "missing");
    expect(missing.length).toBeGreaterThan(0);
    expect(missing.every((item) => item.receiptStatus === "missing")).toBe(true);
    expect(missing.some((item) => item.id === workspace.expenses[0].id)).toBe(false);
    expect(missing.length).toBe(missingReceiptExpenses(workspace.expenses).length);
  });
});

describe("receipt uploads", () => {
  it("rejects disallowed types and oversized files", () => {
    const pdf = new File(["%PDF"], "receipt.pdf", { type: "application/pdf" });
    const exe = new File(["MZ"], "malware.exe", { type: "application/x-msdownload" });
    const huge = new File(["x".repeat(9 * 1024 * 1024)], "huge.pdf", { type: "application/pdf" });
    expect(allowedFile(pdf)).toBe(true);
    expect(uploadFileError(pdf)).toBeNull();
    expect(uploadFileError(exe)).toMatch(/PDF or image/i);
    expect(uploadFileError(huge)).toMatch(/too large/i);
  });

  it("keeps attached receipts private and never treats storage-not-configured as success", () => {
    const workspace = createSeedWorkspace();
    applyPrivateReceiptAttachment(workspace, "exp-ga-registration", "georgia-registration.pdf", "2026-09-14T00:00:00.000Z");
    const file = workspace.files.find((item) => item.relatedTo === "exp-ga-registration" && item.kind === "receipt");
    expect(file?.visibility).toBe("private");
    expect(workspace.files.every(receiptIsPrivate)).toBe(true);
    expect(STORAGE_NOT_CONFIGURED_MESSAGE).toMatch(/Not configured/i);
    expect(STORAGE_NOT_CONFIGURED_MESSAGE.toLowerCase()).not.toContain("uploaded");
    expect(STORAGE_NOT_CONFIGURED_MESSAGE.toLowerCase()).not.toContain("success");
  });
});

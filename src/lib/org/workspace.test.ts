import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import {
  allowedDocumentFile,
  documentUploadError,
  safeObjectFileName,
  sniffDocumentContentType,
} from "@/lib/security/files";
import {
  computeInvoiceTotals,
  derivedInvoiceStatus,
  generatedDocumentPath,
  parseCalendarBounds,
  sanitizeNoteBody,
  validateInvoiceLines,
  workspaceSummaries,
} from "@/lib/org/workspace-model";
import { NOTE_SAVE_RPC, INVOICE_SAVE_RPC, ORG_DOCUMENTS_BUCKET } from "@/lib/org/workspace";

describe("workspace document helpers", () => {
  it("allows only the documented business file types and rejects unsafe names", () => {
    expect(allowedDocumentFile({ name: "brief.pdf", type: "application/pdf", size: 12 })).toBe(true);
    expect(allowedDocumentFile({ name: "photo.PNG", type: "image/png", size: 12 })).toBe(true);
    expect(allowedDocumentFile({ name: "scan.jpg", type: "image/jpeg", size: 12 })).toBe(true);
    expect(allowedDocumentFile({ name: "notes.txt", type: "text/plain", size: 12 })).toBe(true);
    expect(allowedDocumentFile({ name: "payload.html", type: "text/html", size: 12 })).toBe(false);
    expect(allowedDocumentFile({ name: "icon.svg", type: "image/svg+xml", size: 12 })).toBe(false);
    expect(allowedDocumentFile({ name: "macro.docm", type: "application/vnd.ms-word.document.macroEnabled.12", size: 12 })).toBe(false);
    expect(allowedDocumentFile({ name: "run.exe", type: "application/octet-stream", size: 12 })).toBe(false);
    expect(documentUploadError({ name: "notes.txt", type: "text/plain", size: 9 * 1024 * 1024 })).toMatch(/too large/i);
  });

  it("sniffs content types and sanitizes object names without trusting traversal", () => {
    expect(sniffDocumentContentType(Uint8Array.from([0x25, 0x50, 0x44, 0x46]), "application/pdf", "a.pdf")).toBe("application/pdf");
    expect(sniffDocumentContentType(Uint8Array.from([0x3c, 0x68, 0x74, 0x6d, 0x6c]), "text/html", "a.html")).toBe(null);
    expect(safeObjectFileName("../../etc/passwd")).toBe("etc-passwd");
    expect(generatedDocumentPath("11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "../x.pdf")).toBe(
      "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/x.pdf",
    );
  });
});

describe("notes and calendar helpers", () => {
  it("strips HTML from note bodies instead of storing markup", () => {
    expect(sanitizeNoteBody("<script>alert(1)</script>hello")).toBe("scriptalert(1)/scripthello");
  });

  it("rejects inverted calendar ranges and invalid timezones", () => {
    expect(parseCalendarBounds({
      start: "2026-09-21T12:00",
      end: "2026-09-21T11:00",
      allDay: false,
      timezone: "America/New_York",
    })).toMatchObject({ error: expect.stringMatching(/end time/i) });
    expect(parseCalendarBounds({
      start: "2026-09-22",
      end: "2026-09-21",
      allDay: true,
      timezone: "UTC",
    })).toMatchObject({ error: expect.stringMatching(/end date/i) });
    expect(parseCalendarBounds({
      start: "2026-09-21T12:00",
      end: "2026-09-21T13:00",
      allDay: false,
      timezone: "Europe/Paris",
    })).toMatchObject({ error: expect.stringMatching(/timezone/i) });
  });
});

describe("invoice calculation helpers", () => {
  it("computes integer-cent totals on the server helper and ignores a browser total", () => {
    const totals = computeInvoiceTotals(
      [
        { quantity: 2, unitCents: 1500 },
        { quantity: 1, unitCents: 250 },
      ],
      100,
      50,
    );
    expect(totals).toEqual({ subtotalCents: 3250, discountCents: 100, taxCents: 50, totalCents: 3200 });
    expect(validateInvoiceLines([{ description: "Build", quantity: 2, unitCents: 1500 }])).toBeNull();
    expect(validateInvoiceLines([{ description: "", quantity: 1, unitCents: 100 }])).toMatch(/description/i);
    expect(derivedInvoiceStatus({ status: "issued", dueDate: "2020-01-01", archived: false }, "2026-09-20")).toBe("overdue");
    expect(derivedInvoiceStatus({ status: "paid", dueDate: "2020-01-01", archived: false }, "2026-09-20")).toBe("paid");
  });

  it("summarizes operational invoice figures without treating them as accounting reports", () => {
    const summaries = workspaceSummaries({
      now: new Date("2026-09-20T12:00:00.000Z"),
      notes: [{ updatedAt: "2026-09-19T00:00:00.000Z" }],
      documents: [{}, {}],
      events: [{ start: "2026-09-21T12:00:00.000Z" } as never],
      invoices: [
        { status: "draft", archived: false, totalCents: 100, amountPaidCents: 0, dueDate: null } as never,
        { status: "issued", archived: false, totalCents: 5000, amountPaidCents: 0, dueDate: "2026-09-10" } as never,
        { status: "paid", archived: false, totalCents: 2000, amountPaidCents: 2000, dueDate: "2026-09-01" } as never,
      ],
    });
    expect(summaries.documentCount).toBe(2);
    expect(summaries.draftInvoices).toBe(1);
    expect(summaries.outstandingInvoiceTotal).toBe(50);
    expect(summaries.overdueInvoiceTotal).toBe(50);
    expect(summaries.paidInvoiceTotal).toBe(20);
  });
});

describe("day 4 migrations", () => {
  it("adds workspace tables, private storage, integer cents, and no authenticated delete", () => {
    const files = readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).sort();
    expect(files).toEqual(expect.arrayContaining([
      "20260920140000_day4_workspace_tools.sql",
      "20260920141000_day4_workspace_rpcs.sql",
      "20260920142000_day4_storage_documents.sql",
    ]));
    const schema = readFileSync("supabase/migrations/20260920140000_day4_workspace_tools.sql", "utf8");
    const rpcs = readFileSync("supabase/migrations/20260920141000_day4_workspace_rpcs.sql", "utf8");
    const storage = readFileSync("supabase/migrations/20260920142000_day4_storage_documents.sql", "utf8");
    expect(schema).toContain("ws_notes");
    expect(schema).toContain("ws_documents");
    expect(schema).toContain("ws_calendar_events");
    expect(schema).toContain("ws_invoices");
    expect(schema).toContain("ws_invoice_lines");
    expect(schema).toContain("integer not null");
    expect(schema).toContain("force row level security");
    expect(schema).not.toMatch(/create policy[\s\S]{0,80}for delete/i);
    expect(schema).not.toMatch(/double precision|numeric\(/i);
    expect(rpcs).toContain(NOTE_SAVE_RPC);
    expect(rpcs).toContain(INVOICE_SAVE_RPC);
    expect(rpcs).toContain("sts_ws_replace_invoice_lines");
    expect(rpcs).toContain("-- replace_invoice_lines is internal; do not grant to authenticated or anon.");
    expect(storage).toContain(ORG_DOCUMENTS_BUCKET);
    expect(storage).toContain("public = false");
    expect(storage).toContain("Antivirus/malware scanning is not implemented");
    expect(readFileSync("src/app/dashboard/notes/page.tsx", "utf8")).not.toContain("dangerouslySetInnerHTML");
    expect(readFileSync("src/app/dashboard/invoices/page.tsx", "utf8")).not.toContain("PlannedSection");
  });
});

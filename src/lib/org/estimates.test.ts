import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import {
  ESTIMATE_SAVE_RPC,
  ESTIMATE_STATUS_RPC,
  ESTIMATE_ARCHIVE_RPC,
  ESTIMATE_RESTORE_RPC,
} from "@/lib/org/estimates";
import {
  canConvertEstimateToInvoice,
  canTransitionEstimateStatus,
  computeEstimateTotals,
  derivedEstimateStatus,
  draftInvoiceFromAcceptedEstimate,
  matchesEstimateSearch,
  validateEstimateLines,
} from "@/lib/org/estimates-model";
import { ESTIMATE_CONVERT_RPC } from "@/lib/org/workspace";

describe("estimate calculation helpers", () => {
  it("computes integer-cent totals from line quantity, unit, and discount plus header tax", () => {
    const totals = computeEstimateTotals(
      [
        { quantity: 2, unitCents: 1500, discountCents: 100 },
        { quantity: 1, unitCents: 250, discountCents: 0 },
      ],
      50,
    );
    expect(totals).toEqual({ subtotalCents: 3250, discountCents: 100, taxCents: 50, totalCents: 3200 });
    expect(validateEstimateLines([{ description: "Build", quantity: 2, unitCents: 1500, discountCents: 0 }])).toBeNull();
    expect(validateEstimateLines([{ description: "", quantity: 1, unitCents: 100, discountCents: 0 }])).toMatch(/description/i);
    expect(validateEstimateLines([{ description: "Build", quantity: 1, unitCents: 100, discountCents: 200 }])).toMatch(/discount/i);
  });

  it("derives expired display for ready quotes past the expiration date", () => {
    expect(derivedEstimateStatus({ status: "ready", expiresOn: "2020-01-01", archived: false }, "2026-09-20")).toBe("expired");
    expect(derivedEstimateStatus({ status: "accepted", expiresOn: "2020-01-01", archived: false }, "2026-09-20")).toBe("accepted");
    expect(derivedEstimateStatus({ status: "ready", expiresOn: "2026-09-21", archived: false }, "2026-09-20")).toBe("ready");
  });

  it("allows only the documented lifecycle transitions", () => {
    expect(canTransitionEstimateStatus("draft", "ready")).toBe(true);
    expect(canTransitionEstimateStatus("ready", "accepted")).toBe(true);
    expect(canTransitionEstimateStatus("ready", "declined")).toBe(true);
    expect(canTransitionEstimateStatus("ready", "expired")).toBe(true);
    expect(canTransitionEstimateStatus("ready", "draft")).toBe(true);
    expect(canTransitionEstimateStatus("accepted", "draft")).toBe(false);
    expect(canTransitionEstimateStatus("declined", "accepted")).toBe(false);
    expect(canTransitionEstimateStatus("expired", "ready")).toBe(false);
    expect(canTransitionEstimateStatus("draft", "accepted")).toBe(false);
  });

  it("converts only accepted active estimates into a draft invoice with matching integer-cent totals", () => {
    const estimate = {
      id: "est-1",
      estimateNumber: "EST-0007",
      status: "accepted" as const,
      title: "Website rebuild",
      description: "Build",
      clientId: "client-1",
      issueDate: "2026-09-20",
      expiresOn: null,
      currency: "USD",
      internalNotes: "Do not email",
      customerNotes: "Customer facing",
      terms: "Net 15",
      orgLegalName: "STS Media LLC",
      orgDisplayName: "STS Media",
      clientBusinessName: "State Collision",
      clientContactName: "Casey",
      clientEmail: "casey@example.test",
      subtotalCents: 300000,
      discountCents: 5000,
      taxCents: 0,
      totalCents: 295000,
      lines: [
        {
          position: 1,
          description: "Website quote",
          quantity: 2,
          unitCents: 150000,
          discountCents: 5000,
          lineTotalCents: 295000,
        },
      ],
      readyAt: null,
      acceptedAt: "2026-09-20T00:00:00.000Z",
      declinedAt: null,
      expiredAt: null,
      archived: false,
      createdAt: "2026-09-20T00:00:00.000Z",
      updatedAt: "2026-09-20T00:00:00.000Z",
    };
    expect(canConvertEstimateToInvoice(estimate)).toBe(true);
    expect(canConvertEstimateToInvoice({ status: "ready", archived: false })).toBe(false);
    expect(canConvertEstimateToInvoice({ status: "accepted", archived: true })).toBe(false);
    const invoice = draftInvoiceFromAcceptedEstimate(estimate, "winv-abc123", "2026-09-20T12:00:00.000Z");
    expect(invoice).toMatchObject({
      status: "draft",
      sourceEstimateId: "est-1",
      sourceEstimateNumber: "EST-0007",
      notes: "Customer facing",
      paymentInstructions: "Net 15",
      subtotalCents: 300000,
      discountCents: 5000,
      taxCents: 0,
      totalCents: 295000,
      amountPaidCents: 0,
      clientBusinessName: "State Collision",
      orgDisplayName: "STS Media",
    });
    expect(invoice?.lines[0]).toMatchObject({ quantity: 2, unitCents: 150000, lineTotalCents: 300000 });
    expect(invoice?.dueDate).toBe("2026-10-05");
    expect(draftInvoiceFromAcceptedEstimate({ ...estimate, status: "draft" }, "x")).toBeNull();
  });

  it("matches search across number, title, and customer snapshot without requiring email send", () => {
    const estimate = {
      estimateNumber: "EST-0007",
      title: "Website rebuild",
      clientBusinessName: "State Collision",
      clientContactName: "Casey",
      clientEmail: "casey@example.test",
      status: "draft",
    };
    expect(matchesEstimateSearch(estimate as never, "0007")).toBe(true);
    expect(matchesEstimateSearch(estimate as never, "collision")).toBe(true);
    expect(matchesEstimateSearch(estimate as never, "invoice")).toBe(false);
  });
});

describe("day 5 migrations", () => {
  it("adds estimate tables, integer cents, forced RLS, and no authenticated delete", () => {
    const files = readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).sort();
    expect(files).toEqual(expect.arrayContaining([
      "20260920160000_day5_estimates.sql",
      "20260920161000_day5_estimates_rpcs.sql",
      "20260920162000_day5_estimates_no_hard_delete.sql",
    ]));
    const schema = readFileSync("supabase/migrations/20260920160000_day5_estimates.sql", "utf8");
    const rpcs = readFileSync("supabase/migrations/20260920161000_day5_estimates_rpcs.sql", "utf8");
    const revoke = readFileSync("supabase/migrations/20260920162000_day5_estimates_no_hard_delete.sql", "utf8");
    expect(schema).toContain("ws_estimates");
    expect(schema).toContain("ws_estimate_lines");
    expect(schema).toContain("integer not null");
    expect(schema).toContain("force row level security");
    expect(schema).not.toMatch(/create policy[\s\S]{0,80}for delete/i);
    expect(schema).not.toMatch(/double precision|numeric\(/i);
    expect(schema).toContain("array['owner', 'administrator', 'employee']");
    expect(rpcs).toContain(ESTIMATE_SAVE_RPC);
    expect(rpcs).toContain(ESTIMATE_STATUS_RPC);
    expect(rpcs).toContain(ESTIMATE_ARCHIVE_RPC);
    expect(rpcs).toContain(ESTIMATE_RESTORE_RPC);
    expect(rpcs).toContain("sts_est_replace_lines");
    expect(rpcs).toContain("-- next_number, replace_lines, and write_audit are internal; do not grant to authenticated or anon.");
    expect(rpcs).toContain("from_status");
    expect(rpcs).toContain("to_status");
    expect(rpcs).not.toMatch(/p_internal_notes[\s\S]{0,80}audit_events/);
    expect(revoke).toContain("revoke delete on public.ws_estimates");
    expect(readFileSync("src/app/dashboard/estimates/page.tsx", "utf8")).not.toContain("PlannedSection");
    expect(readFileSync("src/app/dashboard/estimates/page.tsx", "utf8")).toMatch(/does not send email/i);
    expect(readFileSync("vercel.json", "utf8")).toContain('"main": true');
    expect(readFileSync("vercel.json", "utf8")).toContain('"*": false');
  });
});

describe("day 6 conversion and print migrations", () => {
  it("adds an atomic idempotent conversion RPC and authenticated print views without public URLs", () => {
    const files = readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).sort();
    expect(files).toContain("20260920170000_day6_estimate_to_invoice.sql");
    const sql = readFileSync("supabase/migrations/20260920170000_day6_estimate_to_invoice.sql", "utf8");
    expect(sql).toContain("source_estimate_id");
    expect(sql).toContain("source_estimate_number");
    expect(sql).toContain("ws_invoices_source_estimate_uidx");
    expect(sql).toContain(ESTIMATE_CONVERT_RPC);
    expect(sql).toContain("security definer");
    expect(sql).toContain("sts_can_write_invoices");
    expect(sql).toContain("estimate.converted_to_invoice");
    expect(sql).toContain("sts_sanitize_audit_metadata");
    expect(sql).toContain("unique_violation");
    expect(sql).toContain("grant execute on function public.sts_convert_ws_estimate_to_invoice(uuid, uuid) to authenticated");
    expect(sql).not.toMatch(/grant execute[\s\S]{0,80}to anon/i);
    expect(sql).not.toMatch(/customer_notes[\s\S]{0,80}audit_events/);
    expect(sql).not.toMatch(/line.description[\s\S]{0,80}audit_events/);
    const estimatePrint = readFileSync("src/app/dashboard/estimates/[id]/print/page.tsx", "utf8");
    const invoicePrint = readFileSync("src/app/dashboard/invoices/[id]/print/page.tsx", "utf8");
    const toolbar = readFileSync("src/components/dashboard/print-toolbar.tsx", "utf8");
    expect(estimatePrint).toContain("loadVisibleEstimates");
    expect(invoicePrint).toContain("loadVisibleWorkspaceRecords");
    expect(toolbar).toContain("Print / Save as PDF");
    expect(toolbar).toContain("window.print()");
    expect(toolbar).toContain("not uploaded or stored");
    expect(estimatePrint).toContain("internalNotes");
    expect(estimatePrint).toContain("no-print");
    expect(readFileSync("src/app/dashboard/estimates/page.tsx", "utf8")).not.toMatch(/does not send email, generate PDFs, collect signatures, convert to invoices/);
    expect(readFileSync("vercel.json", "utf8")).toContain('"main": true');
    expect(readFileSync("vercel.json", "utf8")).toContain('"*": false');
  });
});

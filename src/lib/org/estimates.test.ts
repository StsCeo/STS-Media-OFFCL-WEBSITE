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
  parseEstimateSectionsFromForm,
  validateEstimateLines,
  validateEstimateSections,
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
      sections: [
        { position: 1, heading: "Discovery", body: "Review the current site." },
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
    expect(invoice?.totalCents).toBe(estimate.totalCents);
    expect(JSON.stringify(invoice)).not.toContain("Discovery");
    expect(draftInvoiceFromAcceptedEstimate({ ...estimate, status: "draft" }, "x")).toBeNull();
  });

  it("keeps statement of work sections out of the money calculation", () => {
    const lines = [{ description: "Build", quantity: 1, unitCents: 2500, discountCents: 0 }];
    const totals = computeEstimateTotals(lines, 100);
    expect(validateEstimateSections([{ heading: "Scope", body: "Design and build." }])).toBeNull();
    expect(validateEstimateSections([{ heading: "A", body: "" }])).toMatch(/heading/i);
    expect(validateEstimateSections(Array.from({ length: 41 }, () => ({ heading: "Scope", body: "" })))).toMatch(/40/);
    const form = new FormData();
    form.append("sectionHeading", "  Second  ");
    form.append("sectionBody", "Later");
    form.append("sectionHeading", "First");
    form.append("sectionBody", "Earlier");
    form.append("sectionHeading", " ");
    form.append("sectionBody", " ");
    expect(parseEstimateSectionsFromForm(form)).toEqual([
      { heading: "Second", body: "Later" },
      { heading: "First", body: "Earlier" },
    ]);
    expect(totals).toEqual({ subtotalCents: 2500, discountCents: 0, taxCents: 100, totalCents: 2600 });
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

describe("phase 3b statement of work sections", () => {
  it("adds forced RLS, draft-only writes, and a session-scoped portal read", () => {
    const files = readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).sort();
    const migration = "20260929180000_phase3b_estimate_sections.sql";
    const truncateRevoke = "20261002232544_phase3b_revoke_estimate_truncate.sql";
    const publicIntake = "20261003010000_phase1_public_intake.sql";
    expect(files.at(-1)).toBe(publicIntake);
    expect(files.indexOf(migration)).toBeGreaterThan(files.indexOf("20260924063409_phase3a_crm_journey.sql"));
    expect(files.indexOf(truncateRevoke)).toBeGreaterThan(files.indexOf(migration));
    expect(files.indexOf(publicIntake)).toBeGreaterThan(files.indexOf(truncateRevoke));
    const sql = readFileSync(`supabase/migrations/${migration}`, "utf8");
    const estimateRoles = readFileSync("supabase/migrations/20260920160000_day5_estimates.sql", "utf8");
    expect(sql).toContain("create table if not exists public.ws_estimate_sections");
    expect(sql).toContain("force row level security");
    expect(sql).toContain("sts_freeze_organization_id");
    expect(sql).toContain("sts_can_read_estimates(organization_id)");
    expect(sql).toContain("sts_can_write_estimates(organization_id)");
    expect(estimateRoles).toContain("array['owner', 'administrator', 'employee']");
    expect(sql).not.toContain("'accountant'");
    expect(sql).toContain("invalid organization");
    expect(sql).toContain("parent.status <> 'draft'");
    expect(sql).toContain("parent.archived_at is not null");
    expect(sql).toContain("revoke delete on public.ws_estimate_sections from authenticated");
    expect(sql).toContain("public.sts_save_ws_estimate(");
    expect(sql).toContain("sts_est_replace_sections");
    expect(sql).not.toContain("subtotal_cents =");
    expect(sql).not.toContain("total_cents =");
    expect(sql).toContain("sts_list_client_portal_estimate_sections()");
    expect(sql).toContain("sts_client_portal_session()");
    expect(sql).not.toMatch(/function public\.sts_list_client_portal_estimate_sections\([\s\S]*p_organization_id/);
    expect(sql).not.toMatch(/grant execute[\s\S]{0,160}to anon/i);
    expect(sql).toContain("revoke all on function public.sts_est_replace_sections(uuid, uuid, jsonb) from public, anon, authenticated");
    const portalFn = sql.split("create or replace function public.sts_list_client_portal_estimate_sections()")[1].split("$$;")[0];
    expect(portalFn).toContain("source_type = 'estimate'");
    expect(portalFn).toContain("unpublished_at is null");
    expect(portalFn).not.toMatch(/internal_notes|client_email/);
    expect(readFileSync("supabase/migrations/20260920170000_day6_estimate_to_invoice.sql", "utf8")).not.toContain("ws_estimate_sections");
    expect(readFileSync("supabase/migrations/20260920191000_day8_accountant_base_table_lockdown.sql", "utf8")).toContain("sts_list_accountant_revenue");
    expect(sql).not.toContain("sts_list_accountant_");
    expect(readFileSync("src/app/dashboard/estimates/[id]/print/page.tsx", "utf8")).toContain("sections={estimate.sections}");
    expect(readFileSync("src/components/dashboard/print-toolbar.tsx", "utf8")).toContain("window.print()");
    expect(readFileSync("src/app/client/estimates/[id]/page.tsx", "utf8")).toContain("sections={estimate.sections}");
    expect(readFileSync("src/app/client/estimates/[id]/page.tsx", "utf8")).not.toContain("sectionHeading");
    expect(readFileSync("src/lib/org/client-portal.ts", "utf8")).toContain("sts_list_client_portal_estimate_sections");
    expect(readFileSync("src/lib/org/client-portal.ts", "utf8")).not.toMatch(/p_organization_id/);
    expect(readFileSync("src/components/dashboard/estimate-form.tsx", "utf8")).toContain("Add section");
    expect(readFileSync("src/components/dashboard/estimate-form.tsx", "utf8")).toContain("disabled={locked}");
    const isolation = readFileSync("supabase/tests/phase3b_sow_isolation_runtime.sql", "utf8");
    expect(isolation).toContain("PHASE3B_SOW_ISOLATION_RUNTIME_PASSED");
    expect(isolation).toContain("organization B cannot read organization A sections");
    expect(isolation).toContain("AAL1 cannot read estimate sections");
    expect(isolation).toContain("accountant cannot modify sections");
    expect(isolation).toContain("estimate-to-invoice conversion stays idempotent");
    expect(isolation).toContain("portal client cannot read unpublished estimate sections");
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import {
  ESTIMATE_SAVE_RPC,
  ESTIMATE_STATUS_RPC,
  ESTIMATE_ARCHIVE_RPC,
  ESTIMATE_RESTORE_RPC,
} from "@/lib/org/estimates";
import {
  canTransitionEstimateStatus,
  computeEstimateTotals,
  derivedEstimateStatus,
  matchesEstimateSearch,
  validateEstimateLines,
} from "@/lib/org/estimates-model";

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
    expect(readFileSync("src/app/dashboard/estimates/page.tsx", "utf8")).not.toMatch(/PDF|DocuSign|Stripe|QuickBooks/i);
    expect(readFileSync("vercel.json", "utf8")).toContain('"main": true');
    expect(readFileSync("vercel.json", "utf8")).toContain('"*": false');
  });
});

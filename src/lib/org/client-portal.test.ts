import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CLIENT_PORTAL_READONLY_NOTE,
  attachLines,
  isClientPortalSourceType,
  mapClientPortalDocument,
  mapClientPortalEstimate,
  mapClientPortalInvoice,
  mapClientPortalProject,
  moneyLabel,
} from "@/lib/org/client-portal-model";

describe("client portal model", () => {
  it("maps allowlisted estimate, invoice, project, and document fields", () => {
    const estimate = mapClientPortalEstimate({
      id: "est-1",
      estimate_number: "EST-0001",
      status: "ready",
      title: "Website",
      description: "Public description",
      issue_date: "2026-09-01",
      expires_on: "2026-09-30",
      currency: "USD",
      customer_notes: "Visible note",
      terms: "Net 15",
      org_legal_name: "Scars to Stars Media",
      org_display_name: "STS Media",
      client_business_name: "North Client",
      client_contact_name: "Casey",
      subtotal_cents: 10000,
      discount_cents: 1000,
      tax_cents: 500,
      total_cents: 9500,
    });
    expect(estimate.estimateNumber).toBe("EST-0001");
    expect(estimate.customerNotes).toBe("Visible note");
    expect(JSON.stringify(estimate)).not.toMatch(/internal/i);
    const invoice = mapClientPortalInvoice({
      id: "inv-1",
      invoice_number: "STS-0001",
      status: "issued",
      issue_date: "2026-09-02",
      due_date: "2026-09-16",
      currency: "USD",
      org_legal_name: "Scars to Stars Media",
      org_display_name: "STS Media",
      client_business_name: "North Client",
      client_contact_name: "Casey",
      subtotal_cents: 15000,
      discount_cents: 0,
      tax_cents: 0,
      total_cents: 15000,
    });
    expect(moneyLabel(invoice.totalCents, invoice.currency)).toContain("150");
    expect(JSON.stringify(invoice)).not.toMatch(/payment|notes|email/i);
    const project = mapClientPortalProject({
      id: "proj-1",
      name: "North site",
      description: "Client facing",
      status: "in_development",
      start_date: "2026-09-01",
      deadline: "2026-10-01",
    });
    expect(project.status).toBe("in_development");
    expect(JSON.stringify(project)).not.toMatch(/budget|assigned|profit/i);
    const document = mapClientPortalDocument({
      id: "doc-1",
      title: "welcome.txt",
      description: "Safe description",
      content_type: "text/plain",
      byte_size: 12,
    });
    expect(document.title).toBe("welcome.txt");
    expect(JSON.stringify(document)).not.toMatch(/storage|path|bucket/i);
  });

  it("attaches only matching line items", () => {
    const rows = attachLines(
      [{ id: "inv-1" }, { id: "inv-2" }],
      [
        { parentId: "inv-1", position: 2, description: "B", quantity: 1, unitCents: 2, discountCents: 0, lineTotalCents: 2 },
        { parentId: "inv-1", position: 1, description: "A", quantity: 1, unitCents: 1, discountCents: 0, lineTotalCents: 1 },
        { parentId: "inv-2", position: 1, description: "C", quantity: 1, unitCents: 3, discountCents: 0, lineTotalCents: 3 },
      ],
      (record, lines) => ({ ...record, lines }),
    );
    expect(rows[0].lines.map((line) => line.description)).toEqual(["A", "B"]);
    expect(rows[1].lines).toHaveLength(1);
  });

  it("accepts only the four publication source types", () => {
    expect(isClientPortalSourceType("invoice")).toBe(true);
    expect(isClientPortalSourceType("lead")).toBe(false);
    expect(CLIENT_PORTAL_READONLY_NOTE.toLowerCase()).toContain("read-only");
  });
});

describe("day 9 migrations and surfaces", () => {
  it("adds mapping, publication, safe reads, and denies client mutations", () => {
    const files = readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).sort();
    expect(files).toContain("20260920200000_day9_client_portal.sql");
    const sql = readFileSync("supabase/migrations/20260920200000_day9_client_portal.sql", "utf8");
    expect(sql).toContain("client_portal_identities");
    expect(sql).toContain("client_portal_publications");
    expect(sql).toContain("sts_client_portal_session()");
    expect(sql).toContain("sts_list_client_portal_invoices()");
    expect(sql).toContain("sts_publish_client_portal_record");
    expect(sql).toContain("force row level security");
    expect(sql).toContain("set search_path = public");
    expect(sql).toContain("client_portal.published");
    expect(sql).toContain("client_portal.unpublished");
    expect(sql).toContain("client_portal.document_downloaded");
    expect(sql).not.toMatch(/execute\s+format\(/i);
    expect(sql).not.toMatch(/execute\s+p_/i);
    expect(sql).not.toMatch(/grant execute[\s\S]{0,80}to anon/i);
    expect(sql).not.toMatch(/grant (select|insert|update|delete) on public\.client_portal_[a-z_]+ to authenticated/i);
    expect(sql).toContain("revoke all on public.client_portal_identities from anon, public, authenticated");
    expect(sql).toContain("revoke all on function public.sts_client_portal_document_object_name(uuid) from public, anon, authenticated");
    const invoiceFn = sql.split("create or replace function public.sts_list_client_portal_invoices()")[1].split("$$;")[0];
    const estimateFn = sql.split("create or replace function public.sts_list_client_portal_estimates()")[1].split("$$;")[0];
    const projectFn = sql.split("create or replace function public.sts_list_client_portal_projects()")[1].split("$$;")[0];
    const documentFn = sql.split("create or replace function public.sts_list_client_portal_documents()")[1].split("$$;")[0];
    expect(invoiceFn).not.toMatch(/payment_instructions|client_email|\bnotes\b/);
    expect(estimateFn).not.toMatch(/internal_notes|client_email/);
    expect(projectFn).not.toMatch(/budget_cents|assigned_to|assigned_member_id|\bnotes\b/);
    expect(documentFn).not.toMatch(/storage_path|uploaded_by/);
    const isolation = readFileSync("supabase/tests/day9_isolation_runtime.sql", "utf8");
    expect(isolation).toContain("DAY9_ISOLATION_RUNTIME_PASSED");
    expect(isolation).toContain("client A cannot read client B");
    expect(isolation).toContain("@day9.test");
  });

  it("keeps the client portal read-only and separate from Command Center", () => {
    const page = readFileSync("src/app/client/page.tsx", "utf8");
    expect(page).toContain("Published estimates");
    expect(page).toContain("Published invoices");
    expect(page).not.toMatch(/type=["']submit["']/i);
    expect(page).not.toMatch(/sts_save_|sts_archive_|sts_issue_|sts_publish_|sts_record_ws_invoice_payment/);
    const layout = readFileSync("src/app/client/layout.tsx", "utf8");
    expect(readFileSync("src/components/client/shell.tsx", "utf8")).toContain('data-surface="client"');
    expect(layout).toContain("canAccessClientPortal");
    expect(layout).toContain('redirect("/unauthorized")');
    const download = readFileSync("src/app/client/documents/[id]/download/route.ts", "utf8");
    expect(download).toContain("authorizeClientPortalDocument");
    expect(download).toContain("createServiceRoleClient");
    expect(download).not.toContain("signedUrl");
    expect(download).not.toContain("createSignedUrl");
    const invoice = readFileSync("src/components/client/invoice-document.tsx", "utf8");
    expect(invoice).toContain("Scars to Stars Media");
    expect(invoice).not.toContain("TechVista");
    expect(invoice).toMatch(/Payments, signatures, messaging, and uploads are not available/);
    expect(invoice).not.toMatch(/Pay now|Stripe|Record payment/i);
    const proxy = readFileSync("src/proxy.ts", "utf8");
    expect(proxy).toContain('"/client"');
    const loader = readFileSync("src/lib/org/client-portal.ts", "utf8");
    expect(loader).not.toMatch(/\.from\(["']ws_invoices["']/);
    expect(loader).not.toMatch(/\.from\(["']ws_documents["']/);
    expect(loader).not.toMatch(/p_organization_id/);
    const vercel = readFileSync("vercel.json", "utf8");
    expect(vercel).toContain('"main": true');
    expect(vercel).toContain('"*": false');
  });
});

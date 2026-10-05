import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260922120000_day11_legacy_bucket_tenant_isolation.sql",
  "utf8",
);
const receiptUpload = readFileSync("src/app/actions.ts", "utf8");

describe("day 11 legacy bucket tenant isolation", () => {
  it("scopes receipt objects to the organization and keeps delete closed", () => {
    expect(migration).toContain("bucket_id = 'receipts'");
    expect(migration).toContain("sts_storage_org_id(name)");
    expect(migration).toContain("array['owner', 'administrator']");
    expect(migration).toContain("for select to authenticated");
    expect(migration).toContain("for insert to authenticated");
    expect(migration).not.toMatch(/bucket_id = 'receipts'[\s\S]{0,180}for delete/i);
    expect(migration).not.toMatch(/bucket_id = 'receipts'[\s\S]{0,180}for update/i);
    expect(receiptUpload).toContain("${organizationId}/${expenseId}/");
    expect(receiptUpload).not.toContain("const path = `${expenseId}/${Date.now()}");
  });

  it("fails the unused documents bucket closed", () => {
    expect(migration).toContain("drop policy if exists documents_owner_select");
    expect(migration).toContain("drop policy if exists documents_owner_write");
    expect(migration).not.toMatch(/create policy documents_/i);
    expect(migration).toContain("set public = false");
  });

  it("does not rewrite org-documents policies", () => {
    expect(migration).not.toContain("org_documents_select_scoped");
    expect(migration).not.toContain("org_documents_insert_scoped");
  });
});

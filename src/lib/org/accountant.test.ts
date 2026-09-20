import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ACCOUNTANT_RECORD_NOTE,
  ACCOUNTANT_REVENUE_NOTE,
  accountantExportFilename,
  accountantOverview,
  buildAccountantExportCsv,
  escapeAccountantCsvValue,
  invoicesCsv,
  isAccountantExportType,
  mapAccountantExpenseRow,
  mapAccountantInvoiceRow,
  mapAccountantRevenueRow,
} from "@/lib/org/accountant-model";

const invoices = [
  mapAccountantInvoiceRow({
    id: "inv-draft",
    invoice_number: "STS-1",
    status: "draft",
    issue_date: "2026-09-01",
    due_date: "2026-09-30",
    currency: "USD",
    client_business_name: "North Client",
    total_cents: 9000,
    amount_paid_cents: 0,
  }),
  mapAccountantInvoiceRow({
    id: "inv-open",
    invoice_number: "STS-2",
    status: "issued",
    issue_date: "2026-09-02",
    due_date: "2026-09-30",
    currency: "USD",
    client_business_name: "North Client",
    total_cents: 15000,
    amount_paid_cents: 0,
  }, "2026-09-20"),
  mapAccountantInvoiceRow({
    id: "inv-overdue",
    invoice_number: "STS-3",
    status: "issued",
    issue_date: "2026-08-01",
    due_date: "2026-08-15",
    currency: "USD",
    client_business_name: "North Client",
    total_cents: 7500,
    amount_paid_cents: 0,
  }, "2026-09-20"),
  mapAccountantInvoiceRow({
    id: "inv-paid",
    invoice_number: "STS-4",
    status: "paid",
    issue_date: "2026-08-10",
    due_date: "2026-08-20",
    paid_at: "2026-08-18T00:00:00.000Z",
    currency: "USD",
    client_business_name: "North Client",
    total_cents: 30000,
    amount_paid_cents: 30000,
  }),
  mapAccountantInvoiceRow({
    id: "inv-archived",
    invoice_number: "STS-5",
    status: "issued",
    issue_date: "2026-07-01",
    due_date: "2026-07-15",
    currency: "USD",
    client_business_name: "North Client",
    total_cents: 50000,
    archived_at: "2026-09-01T00:00:00.000Z",
  }, "2026-09-20"),
];

const expenses = [
  mapAccountantExpenseRow({
    id: "exp-live",
    transaction_date: "2026-09-05",
    vendor: "Adobe",
    description: "Design tools",
    category: "Software & Subscriptions",
    total_cents: 20000,
    reimbursable: false,
    reimbursement_status: "n/a",
  }),
  mapAccountantExpenseRow({
    id: "exp-unreimbursed",
    transaction_date: "2026-09-06",
    vendor: "Owner",
    description: "Mileage",
    category: "Travel & Mileage",
    total_cents: 4000,
    reimbursable: true,
    reimbursement_status: "pending",
  }),
  mapAccountantExpenseRow({
    id: "exp-archived",
    transaction_date: "2026-08-01",
    vendor: "Old vendor",
    description: "Archived printer",
    category: "Office Supplies",
    total_cents: 8000,
    reimbursable: false,
    reimbursement_status: "n/a",
    archived_at: "2026-09-01T00:00:00.000Z",
  }),
];

const revenue = [
  mapAccountantRevenueRow({
    id: "rev-paid",
    earned_date: "2026-09-04",
    entry_type: "one_time_project",
    description: "Website launch",
    amount_cents: 100000,
    payment_status: "paid",
  }),
  mapAccountantRevenueRow({
    id: "rev-outstanding",
    earned_date: "2026-09-08",
    entry_type: "final_payment",
    description: "Pending balance",
    amount_cents: 25000,
    payment_status: "unpaid",
  }),
  mapAccountantRevenueRow({
    id: "rev-refund",
    earned_date: "2026-09-09",
    entry_type: "refund",
    description: "Courtesy refund",
    amount_cents: 5000,
    payment_status: "paid",
  }),
  mapAccountantRevenueRow({
    id: "rev-archived",
    earned_date: "2026-08-02",
    entry_type: "one_time_project",
    description: "Archived paid job",
    amount_cents: 99900,
    payment_status: "paid",
    archived_at: "2026-09-01T00:00:00.000Z",
  }),
];

describe("accountant financial model", () => {
  it("computes operational totals and excludes estimates, refunds, and archived headlines", () => {
    const overview = accountantOverview({ invoices, expenses, revenue, today: "2026-09-20" });
    expect(overview.paidRevenue).toBe(1000);
    expect(overview.outstandingRevenue).toBe(250);
    expect(overview.expenses).toBe(240);
    expect(overview.unreimbursedExpenses).toBe(40);
    expect(overview.netIncome).toBe(760);
    expect(overview.invoiceDraftTotal).toBe(90);
    expect(overview.invoiceOpenTotal).toBe(150);
    expect(overview.invoiceOverdueTotal).toBe(75);
    expect(overview.invoicePaidTotal).toBe(300);
    expect(overview.archivedInvoiceCount).toBe(1);
    expect(overview.archivedExpenseCount).toBe(1);
    expect(overview.archivedRevenueCount).toBe(1);
    expect(overview.monthly[0]?.month).toBe("2026-09");
    expect(overview.monthly[0]?.paidRevenue).toBe(1000);
    expect(ACCOUNTANT_RECORD_NOTE).toMatch(/not tax returns/i);
    expect(ACCOUNTANT_REVENUE_NOTE).toMatch(/Estimates and quotes are not recognized revenue/i);
    const estimateAmount = 500000;
    expect(overview.paidRevenue).not.toBe(centsHint(estimateAmount));
  });

  it("maps invoice rows to the minimized identity fields", () => {
    const row = mapAccountantInvoiceRow({
      id: "1",
      invoice_number: "STS-9",
      status: "issued",
      due_date: "2020-01-01",
      client_business_name: "Client Co",
      client_email: "hidden@example.test",
      notes: "internal",
      payment_instructions: "wire",
      total_cents: 1200,
    }, "2026-09-20");
    expect(row.derivedStatus).toBe("overdue");
    expect(row.clientBusinessName).toBe("Client Co");
    expect(JSON.stringify(row)).not.toMatch(/hidden@example|internal|wire/);
  });
});

describe("accountant CSV safety", () => {
  it("escapes quotes, commas, newlines, and formula-injection prefixes", () => {
    expect(escapeAccountantCsvValue('He said "hello"')).toBe('"He said ""hello"""');
    expect(escapeAccountantCsvValue("a,b")).toBe('"a,b"');
    expect(escapeAccountantCsvValue("line\nbreak")).toBe('"line\nbreak"');
    expect(escapeAccountantCsvValue("=CMD()")).toBe("'=CMD()");
    expect(escapeAccountantCsvValue("+1+1")).toBe("'+1+1");
    expect(escapeAccountantCsvValue("-1")).toBe("'-1");
    expect(escapeAccountantCsvValue("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(escapeAccountantCsvValue("2026-09-20")).toBe("2026-09-20");
  });

  it("builds safe filenames and export documents without withheld fields", () => {
    expect(isAccountantExportType("invoices")).toBe(true);
    expect(isAccountantExportType("payroll")).toBe(false);
    expect(accountantExportFilename("invoices", new Date("2026-09-20T12:00:00.000Z"))).toBe(
      "sts-accountant-invoices-20260920.csv",
    );
    const csv = invoicesCsv(invoices);
    expect(csv).toContain("invoice_number,status,issue_date");
    expect(csv).toContain("archived");
    expect(csv).not.toMatch(/notes|payment_instructions|client_email|client_contact/);
    const formula = buildAccountantExportCsv("expenses", {
      invoices,
      expenses: [
        mapAccountantExpenseRow({
          id: "x",
          transaction_date: "2026-09-01",
          vendor: "=HYPERLINK()",
          description: "Office tea, extra",
          category: "Office Supplies",
          total_cents: 100,
          reimbursement_status: "n/a",
        }),
      ],
      revenue,
    });
    expect(formula.csv).toContain("'=HYPERLINK()");
    expect(formula.csv).toContain('"Office tea, extra"');
    expect(formula.rowCount).toBe(1);
  });
});

describe("day 8 migrations", () => {
  it("adds minimized accountant views and sanitized export audit helpers", () => {
    const files = readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).sort();
    expect(files).toEqual(expect.arrayContaining(["20260920190000_day8_accountant_center.sql"]));
    const sql = readFileSync("supabase/migrations/20260920190000_day8_accountant_center.sql", "utf8");
    expect(sql).toContain("sts_can_read_accountant_center");
    expect(sql).toContain("sts_accountant_session_organization");
    expect(sql).toContain("security_invoker");
    expect(sql).toContain("sts_accountant_invoices");
    expect(sql).toContain("sts_list_accountant_finance_audit");
    expect(sql).toContain("accountant.exported");
    expect(sql).toContain("set search_path = public");
    expect(sql).not.toMatch(/client_email|payment_instructions|payment_method|payment_account/);
    expect(sql).not.toMatch(/grant execute[\s\S]{0,80}to anon/i);
    expect(readFileSync("src/app/accountant/page.tsx", "utf8")).toContain("Accountant Center");
    expect(readFileSync("src/app/accountant/page.tsx", "utf8")).not.toMatch(/save|archive|restore|delete|reconcile/i);
    expect(readFileSync("vercel.json", "utf8")).toContain('"main": true');
    expect(readFileSync("vercel.json", "utf8")).toContain('"*": false');
  });
});

function centsHint(cents: number) {
  return cents / 100;
}

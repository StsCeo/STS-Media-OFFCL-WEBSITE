import { describe, expect, it } from "vitest";
import { OPS_EXPENSE_CATEGORIES } from "@/lib/types";
import {
  GENERIC_OPS_ERROR,
  isPersistedOpsId,
  mapOpsExpenseRow,
  mapOpsProjectRow,
  mapOpsRevenueRow,
  mapOpsTaskRow,
  normalizeExpenseInput,
  normalizeRevenueInput,
  operationalTotals,
  OPS_ESTIMATE_NOTE,
} from "./operations";

describe("operations persistence helpers", () => {
  it("maps integer cents without using binary floats for storage", () => {
    const expense = mapOpsExpenseRow({
      id: "11111111-1111-4111-8111-111111111111",
      transaction_date: "2026-09-20",
      posted_date: "2026-09-20",
      vendor: "GoDaddy",
      description: "Domain renewal",
      pretax_cents: 1010,
      tax_cents: 90,
      currency: "USD",
      category: "Domain & Website",
      subcategory: "",
      client_id: null,
      project_id: null,
      business_purpose: "Site",
      payment_account: "Operating",
      payment_method: "Card",
      recurring: false,
      billing_frequency: "yearly",
      receipt_name: null,
      receipt_status: "missing",
      reimbursable: true,
      reimbursement_status: "pending",
      direct_project_cost: false,
      notes: "",
      created_by: "Owner",
      created_at: "2026-09-20T00:00:00.000Z",
      updated_at: "2026-09-20T00:00:00.000Z",
      archived_at: null,
    });
    expect(expense.pretaxAmount).toBe(10.1);
    expect(expense.salesTax).toBe(0.9);
    expect(expense.totalAmount).toBe(11);
    expect(expense.reimbursable).toBe(true);
    expect(expense.archived).toBe(false);

    const revenue = mapOpsRevenueRow({
      id: "22222222-2222-4222-8222-222222222222",
      earned_date: "2026-09-20",
      entry_type: "one_time_project",
      description: "Website build",
      amount_cents: 250000,
      currency: "USD",
      client_id: null,
      project_id: null,
      source_label: "State Collision Pro",
      invoice_status: "sent",
      payment_status: "unpaid",
      due_date: "2026-10-01",
      recognized: false,
      notes: "",
    });
    expect(revenue.amount).toBe(2500);
    expect(revenue.paymentStatus).toBe("unpaid");
  });

  it("rejects non-uuid in-memory ids as persisted operations ids", () => {
    expect(isPersistedOpsId("exp-123")).toBe(false);
    expect(isPersistedOpsId("11111111-1111-4111-8111-111111111111")).toBe(true);
  });

  it("normalizes reimbursable status and paid revenue defaults", () => {
    expect(normalizeExpenseInput({ vendor: "Acme", reimbursable: true }).reimbursementStatus).toBe("pending");
    expect(normalizeExpenseInput({ vendor: "Acme", reimbursable: false, reimbursementStatus: "reimbursed" }).reimbursementStatus).toBe("n/a");
    expect(normalizeRevenueInput({ description: "Build", amount: 100, paymentStatus: "paid" }).paymentStatus).toBe("paid");
  });

  it("includes STS Media expense categories used by the ledger", () => {
    expect(OPS_EXPENSE_CATEGORIES).toEqual(expect.arrayContaining([
      "Business Formation",
      "Registered Agent",
      "Domain & Website",
      "Software & Subscriptions",
      "Advertising & Marketing",
      "Office Supplies",
      "Equipment",
      "Phone & Internet",
      "Professional Services",
      "Banking & Processing Fees",
      "Travel & Mileage",
      "Meals",
      "Education & Training",
      "Other",
      "Needs review",
    ]));
  });

  it("computes operational estimates with rounding, zeros, and empty ledgers", () => {
    expect(operationalTotals({ expenses: [], revenue: [], projects: [], tasks: [] })).toEqual({
      totalRevenue: 0,
      totalExpenses: 0,
      netIncome: 0,
      outstandingRevenue: 0,
      unreimbursedExpenses: 0,
      activeProjects: 0,
      openTasks: 0,
      overdueTasks: 0,
    });

    const totals = operationalTotals({
      now: new Date("2026-09-20T12:00:00.000Z"),
      expenses: [
        mapOpsExpenseRow({
          id: "33333333-3333-4333-8333-333333333333",
          transaction_date: "2026-09-01",
          posted_date: "2026-09-01",
          vendor: "Adobe",
          description: "Creative Cloud",
          pretax_cents: 1050,
          tax_cents: 0,
          currency: "USD",
          category: "Software & Subscriptions",
          subcategory: "",
          reimbursable: true,
          reimbursement_status: "pending",
          created_at: "2026-09-01T00:00:00.000Z",
          updated_at: "2026-09-01T00:00:00.000Z",
        }),
        mapOpsExpenseRow({
          id: "44444444-4444-4444-8444-444444444444",
          transaction_date: "2026-09-01",
          posted_date: "2026-09-01",
          vendor: "Archived vendor",
          description: "Archived cost",
          pretax_cents: 9999,
          tax_cents: 0,
          currency: "USD",
          category: "Other",
          subcategory: "",
          reimbursable: false,
          reimbursement_status: "n/a",
          created_at: "2026-09-01T00:00:00.000Z",
          updated_at: "2026-09-01T00:00:00.000Z",
          archived_at: "2026-09-02T00:00:00.000Z",
        }),
      ],
      revenue: [
        mapOpsRevenueRow({
          id: "55555555-5555-4555-8555-555555555555",
          earned_date: "2026-09-01",
          entry_type: "one_time_project",
          description: "Paid build",
          amount_cents: 10000,
          payment_status: "paid",
          source_label: "Client A",
        }),
        mapOpsRevenueRow({
          id: "66666666-6666-4666-8666-666666666666",
          earned_date: "2026-09-01",
          entry_type: "one_time_project",
          description: "Open invoice",
          amount_cents: 2550,
          payment_status: "unpaid",
          source_label: "Client B",
        }),
      ],
      projects: [
        mapOpsProjectRow({
          id: "77777777-7777-4777-8777-777777777777",
          name: "Active site",
          stage: "in_development",
          notes: "",
        }),
        mapOpsProjectRow({
          id: "88888888-8888-4888-8888-888888888888",
          name: "Done",
          stage: "completed",
          notes: "",
        }),
      ],
      tasks: [
        mapOpsTaskRow({
          id: "99999999-9999-4999-8999-999999999999",
          title: "Overdue copy",
          status: "todo",
          priority: "high",
          due_date: "2026-09-01",
          assigned_to: "Owner",
        }),
        mapOpsTaskRow({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          title: "Finished",
          status: "done",
          priority: "low",
          assigned_to: "Owner",
        }),
      ],
    });
    expect(totals.totalRevenue).toBe(100);
    expect(totals.totalExpenses).toBe(10.5);
    expect(totals.netIncome).toBe(89.5);
    expect(totals.outstandingRevenue).toBe(25.5);
    expect(totals.unreimbursedExpenses).toBe(10.5);
    expect(totals.activeProjects).toBe(1);
    expect(totals.openTasks).toBe(1);
    expect(totals.overdueTasks).toBe(1);
    expect(GENERIC_OPS_ERROR).not.toMatch(/password|secret|token/i);
    expect(OPS_ESTIMATE_NOTE).toMatch(/operational estimate/i);
  });
});

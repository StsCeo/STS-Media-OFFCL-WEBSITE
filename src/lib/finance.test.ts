import { describe, expect, it } from "vitest";
import { activeMrr, cashAmount, computeFinance, computeFinanceFromLedgers, recognizedRevenueAmount } from "./finance";
import { createSeedWorkspace } from "./data/seed";
import type { RevenueEntry, SubscriptionRecord } from "./types";

const paidProject: RevenueEntry = {
  id: "1",
  date: "2026-09-01",
  type: "one_time_project",
  description: "Build",
  amount: 500,
  currency: "USD",
  clientId: "c1",
  projectId: "p1",
  service: "Website design and development",
  invoiceStatus: "paid",
  paymentStatus: "paid",
  dueDate: "2026-09-01",
  stripeCustomerId: "",
  stripeSubscriptionId: "",
  recognized: true,
  notes: "",
  demoLabel: true,
};

const unpaidInvoice: RevenueEntry = {
  ...paidProject,
  id: "2",
  paymentStatus: "unpaid",
  invoiceStatus: "sent",
};

const refund: RevenueEntry = {
  ...paidProject,
  id: "3",
  type: "refund",
  amount: 50,
};

describe("finance definitions", () => {
  it("does not count unpaid invoices as recognized revenue or cash", () => {
    expect(recognizedRevenueAmount(unpaidInvoice)).toBe(0);
    expect(cashAmount(unpaidInvoice)).toBe(0);
  });

  it("counts paid one-time fees as revenue but never as MRR", () => {
    expect(recognizedRevenueAmount(paidProject)).toBe(500);
    expect(
      activeMrr([
        {
          id: "s1",
          clientId: "c1",
          projectId: "p1",
          name: "Maintenance",
          monthlyAmount: 150,
          status: "active",
          startDate: "2026-09-01",
          stripeSubscriptionId: "",
        } satisfies SubscriptionRecord,
      ]),
    ).toBe(150);
  });

  it("subtracts refunds from cash collected", () => {
    expect(cashAmount(refund)).toBe(-50);
  });

  it("computes ARR as MRR times 12 and keeps cash flow separate from profit", () => {
    const workspace = createSeedWorkspace();
    const metrics = computeFinance(workspace, {
      from: new Date("2026-01-01"),
      to: new Date("2026-12-31T23:59:59"),
    });
    expect(metrics.arr).toBe(metrics.mrr * 12);
    expect(metrics.accountingProfit).toBe(metrics.netProfit);
    expect(metrics.cashFlow).toBe(metrics.cashCollected - metrics.totalExpenses);
  });

  it("does not hardcode the Georgia baseline total into calculations", () => {
    const workspace = createSeedWorkspace();
    const registration = workspace.expenses.find((item) => item.id === "exp-ga-registration");
    expect(registration).toBeTruthy();
    registration!.totalAmount = 80;
    const year = computeFinance(workspace, {
      from: new Date("2026-01-01"),
      to: new Date("2026-12-31T23:59:59"),
    });
    const sum = workspace.expenses
      .filter((item) => !item.archived)
      .reduce((total, item) => total + item.totalAmount, 0);
    expect(year.totalExpenses).toBe(sum);
  });

  it("computes ledger totals from empty organization datasets as zeros", () => {
    const empty = computeFinanceFromLedgers([], [], [], [], {
      from: new Date("2026-01-01"),
      to: new Date("2026-12-31T23:59:59"),
    });
    expect(empty.grossRevenue).toBe(0);
    expect(empty.totalExpenses).toBe(0);
    expect(empty.netProfit).toBe(0);
    expect(empty.outstandingInvoices).toBe(0);
  });
});

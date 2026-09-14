import { addDays, endOfQuarter, endOfYear, startOfQuarter, startOfYear, subDays } from "date-fns";
import type { DatePreset, Expense, RevenueEntry, SubscriptionRecord, WorkspaceState } from "./types";
import { endOfDay, inRange, roundMoney, startOfDay } from "./utils";

export const FINANCE_DEFINITIONS = {
  grossRevenue:
    "Gross revenue is recognized one-time and recurring revenue before expenses. Pending payments are not included until they are paid.",
  mrr: "MRR is the normalized monthly value of active recurring customer subscriptions. One-time project fees are not counted in MRR or ARR.",
  arr: "ARR is current MRR multiplied by 12.",
  grossProfit:
    "Gross profit is revenue minus direct costs required to deliver client work.",
  netProfit: "Net profit is revenue minus all recognized business expenses.",
  cashCollected:
    "Cash collected is payments actually received. Pending payments are not counted as collected cash.",
  outstandingInvoices:
    "Outstanding invoices are issued invoices that have not been fully paid.",
  cashVsAccrual:
    "Cash flow and accounting profit are displayed separately. Owner contributions, transfers, and owner draws must not be categorized as revenue or business expenses.",
} as const;

export function rangeFromPreset(preset: DatePreset, customFrom?: Date, customTo?: Date, now = new Date()) {
  if (preset === "custom" && customFrom && customTo) {
    return { from: startOfDay(customFrom), to: endOfDay(customTo) };
  }
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "7d":
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case "quarter":
      return { from: startOfDay(startOfQuarter(now)), to: endOfDay(endOfQuarter(now)) };
    case "year":
      return { from: startOfDay(startOfYear(now)), to: endOfDay(endOfYear(now)) };
    case "30d":
    default:
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
  }
}

export function isCollected(entry: RevenueEntry) {
  return entry.paymentStatus === "paid" && entry.type !== "refund";
}

export function recognizedRevenueAmount(entry: RevenueEntry) {
  if (!entry.recognized) return 0;
  if (entry.paymentStatus !== "paid" && entry.type !== "refund" && entry.type !== "discount") {
    return 0;
  }
  if (entry.type === "refund" || entry.type === "discount" || entry.type === "processing_fee") {
    return -Math.abs(entry.amount);
  }
  if (entry.type === "tax_collected") return 0;
  return entry.amount;
}

export function cashAmount(entry: RevenueEntry) {
  if (entry.paymentStatus !== "paid") return 0;
  if (entry.type === "refund") return -Math.abs(entry.amount);
  if (entry.type === "discount") return 0;
  return entry.amount;
}

export function activeMrr(subscriptions: SubscriptionRecord[]) {
  return roundMoney(
    subscriptions
      .filter((item) => item.status === "active")
      .reduce((sum, item) => sum + item.monthlyAmount, 0),
  );
}

export function computeFinance(
  workspace: WorkspaceState,
  range: { from: Date; to: Date },
) {
  const expenses = workspace.expenses.filter(
    (item) => !item.archived && inRange(item.transactionDate, range.from, range.to),
  );
  const revenue = workspace.revenue.filter((item) => inRange(item.date, range.from, range.to));
  const invoices = workspace.invoices;

  const grossRevenue = roundMoney(revenue.reduce((sum, item) => sum + recognizedRevenueAmount(item), 0));
  const cashCollected = roundMoney(revenue.reduce((sum, item) => sum + cashAmount(item), 0));
  const totalExpenses = roundMoney(expenses.reduce((sum, item) => sum + item.totalAmount, 0));
  const directCosts = roundMoney(
    expenses.filter((item) => item.directProjectCost).reduce((sum, item) => sum + item.totalAmount, 0),
  );
  const mrr = activeMrr(workspace.subscriptions);
  const arr = roundMoney(mrr * 12);
  const grossProfit = roundMoney(grossRevenue - directCosts);
  const netProfit = roundMoney(grossRevenue - totalExpenses);
  const outstandingInvoices = roundMoney(
    invoices
      .filter((item) => !["paid", "void", "draft"].includes(item.status))
      .reduce((sum, item) => sum + Math.max(item.total - item.amountPaid, 0), 0),
  );

  return {
    grossRevenue,
    cashCollected,
    totalExpenses,
    directCosts,
    mrr,
    arr,
    grossProfit,
    netProfit,
    outstandingInvoices,
    accountingProfit: netProfit,
    cashFlow: roundMoney(cashCollected - totalExpenses),
  };
}

export type FinanceMetrics = ReturnType<typeof computeFinance>;

export function expensesByCategory(expenses: Expense[]) {
  const map = new Map<string, number>();
  for (const item of expenses) {
    if (item.archived) continue;
    map.set(item.category, roundMoney((map.get(item.category) ?? 0) + item.totalAmount));
  }
  return [...map.entries()].map(([category, total]) => ({ category, total }));
}

export function revenueByService(entries: RevenueEntry[]) {
  const map = new Map<string, number>();
  for (const item of entries) {
    const amount = recognizedRevenueAmount(item);
    if (!amount) continue;
    map.set(item.service || "Unassigned", roundMoney((map.get(item.service || "Unassigned") ?? 0) + amount));
  }
  return [...map.entries()].map(([service, total]) => ({ service, total }));
}

export function monthKey(iso: string) {
  return iso.slice(0, 7);
}

export function trendSeries(workspace: WorkspaceState, months = 6, now = new Date()) {
  const points = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const revenue = workspace.revenue
      .filter((item) => monthKey(item.date) === key)
      .reduce((sum, item) => sum + recognizedRevenueAmount(item), 0);
    const expenses = workspace.expenses
      .filter((item) => !item.archived && monthKey(item.transactionDate) === key)
      .reduce((sum, item) => sum + item.totalAmount, 0);
    points.push({
      month: date.toLocaleString("en-US", { month: "short" }),
      revenue: roundMoney(revenue),
      expenses: roundMoney(expenses),
      profit: roundMoney(revenue - expenses),
      mrr: activeMrr(workspace.subscriptions),
      arr: roundMoney(activeMrr(workspace.subscriptions) * 12),
    });
  }
  return points;
}

export function upcomingWindow(days = 30, now = new Date()) {
  return { from: startOfDay(now), to: endOfDay(addDays(now, days)) };
}

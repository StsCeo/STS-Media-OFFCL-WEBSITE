import { formatCurrency } from "./utils";

export function dollarsToCents(amount: number) {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

export function centsToDollars(cents: number) {
  if (!Number.isFinite(cents)) return 0;
  return cents / 100;
}

export function formatCents(cents: number, currency = "USD") {
  return formatCurrency(centsToDollars(cents), currency);
}

export function parseDollarsToCents(value: string | number) {
  const amount = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""));
  return dollarsToCents(Number.isFinite(amount) ? amount : 0);
}

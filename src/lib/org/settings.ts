import { z } from "zod";
import { sanitizeText } from "@/lib/validation";
import type { BusinessSettingsInput } from "./types";

export const ISO_CURRENCIES = ["USD", "CAD", "EUR", "GBP", "MXN"] as const;

export const FISCAL_YEAR_MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
] as const;

export const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "UTC",
] as const;

function isValidTimeZone(value: string) {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export const businessSettingsSchema = z.object({
  legalName: z.string().trim().min(2, "Enter the legal business name.").max(160),
  displayName: z.string().trim().min(2, "Enter the display name.").max(80),
  timezone: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .refine(isValidTimeZone, "Choose a valid time zone."),
  baseCurrency: z.enum(ISO_CURRENCIES),
  fiscalYearStart: z.coerce.number().int().min(1).max(12),
  invoicePrefix: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{2,12}$/, "Invoice prefix must be 2–12 letters or numbers."),
  estimatePrefix: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{2,12}$/, "Estimate prefix must be 2–12 letters or numbers."),
  defaultPaymentTerms: z.string().trim().min(2).max(80),
});

export function parseBusinessSettingsForm(formData: FormData): {
  success: true;
  data: BusinessSettingsInput;
} | { success: false; error: string } {
  const parsed = businessSettingsSchema.safeParse({
    legalName: formData.get("legalName"),
    displayName: formData.get("displayName"),
    timezone: formData.get("timezone"),
    baseCurrency: formData.get("baseCurrency"),
    fiscalYearStart: formData.get("fiscalYearStart"),
    invoicePrefix: formData.get("invoicePrefix"),
    estimatePrefix: formData.get("estimatePrefix"),
    defaultPaymentTerms: formData.get("defaultPaymentTerms"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }
  return {
    success: true,
    data: {
      legalName: sanitizeText(parsed.data.legalName),
      displayName: sanitizeText(parsed.data.displayName),
      timezone: parsed.data.timezone,
      baseCurrency: parsed.data.baseCurrency,
      fiscalYearStart: parsed.data.fiscalYearStart,
      invoicePrefix: parsed.data.invoicePrefix.toUpperCase(),
      estimatePrefix: parsed.data.estimatePrefix.toUpperCase(),
      defaultPaymentTerms: sanitizeText(parsed.data.defaultPaymentTerms),
    },
  };
}

export const GENERIC_SETTINGS_ERROR = "We could not save business settings. Try again.";

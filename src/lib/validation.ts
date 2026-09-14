import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  businessName: z.string().trim().max(160).optional().default(""),
  email: z.email(),
  phone: z.string().trim().max(40).optional().default(""),
  service: z.string().trim().min(1).max(120),
  budget: z.string().trim().max(80).optional().default(""),
  audience: z.enum(["owner", "creator", "both"]).optional().default("both"),
  preferredContact: z.enum(["email", "phone", "either"]),
  message: z.string().trim().min(10).max(5000),
  consent: z.boolean().refine((value) => value === true, "Consent is required."),
  companyWebsite: z.string().max(0).optional().default(""),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128).optional(),
  next: z.string().optional(),
});

export const expenseSchema = z.object({
  transactionDate: z.string().min(8),
  vendor: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(240),
  pretaxAmount: z.number().min(0),
  salesTax: z.number().min(0),
  category: z.string().min(1),
});

export const vulnerabilitySchema = z.object({
  reporter: z.string().trim().max(120).optional().default(""),
  email: z.union([z.literal(""), z.email()]).optional().default(""),
  product: z.enum(["public-site", "command-center", "auth", "other"]),
  summary: z.string().trim().min(10).max(200),
  details: z.string().trim().min(20).max(8000),
  goodFaith: z.boolean().refine((value) => value === true, "Good-faith confirmation is required."),
  companyWebsite: z.string().max(0).optional().default(""),
});

export function sanitizeText(value: string) {
  return value.replace(/[<>]/g, "").trim();
}

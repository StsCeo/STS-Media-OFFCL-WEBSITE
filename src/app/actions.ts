"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { CONSENT_COOKIE, DEMO_COOKIE, PALETTE_COOKIE, isDemoModeEnabled, isObjectStorageConfigured, isSupabaseConfigured } from "@/lib/config";
import { getWorkspace, mutateWorkspace, stampAudit } from "@/lib/data/store";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";
import { allowedFile, assertSameOrigin } from "@/lib/security/origin";
import { uploadFileError, safeUploadFileName } from "@/lib/security/files";
import { describeAuthFlowState, describeMfaAttempt, looksForgedToken, NOT_CONFIGURED_MESSAGE } from "@/lib/auth/phase1-flows";
import { resolveNoteRelationship } from "@/lib/notes";
import { applyPrivateReceiptAttachment, STORAGE_NOT_CONFIGURED_MESSAGE } from "@/lib/receipts";
import { passwordScore } from "@/lib/security/password";
import { getPalette } from "@/lib/theme/palettes";
import type {
  BusinessProfile,
  ClientRecord,
  Expense,
  Lead,
  OsDocument,
  OsTransaction,
  OwnerNote,
  Project,
  RevenueEntry,
  TaskItem,
  TaxChecklistItem,
} from "@/lib/types";
import { isSafeRedirect } from "@/lib/utils";
import { contactSchema, sanitizeText, vulnerabilitySchema } from "@/lib/validation";
import { clearCurrentAuth, createSupabaseServer, requireOwnerWrite } from "@/lib/auth/session";
import { demoSessionCookieOptions, getDemoSessionSecret, signDemoSession } from "@/lib/auth/demo-session";
import { GENERIC_AUTH_ERROR, isAllowedOwnerEmail, normalizeEmail } from "@/lib/auth/owner";
import { parseDollarsToCents } from "@/lib/money";

function isSafePath(path: string) {
  return isSafeRedirect(path);
}

export async function startDemoSession(formData: FormData) {
  await assertSameOrigin();
  if (formData.has("code") || formData.has("password") || formData.has("confirm")) {
    redirect("/login");
  }
  if (!isDemoModeEnabled() || !getDemoSessionSecret()) {
    redirect("/login");
  }
  const next = String(formData.get("next") || "/dashboard");
  const mode = String(formData.get("mode") || "owner") === "needs_mfa" ? "needs_mfa" : "owner";
  const token = await signDemoSession(mode);
  const jar = await cookies();
  jar.set(DEMO_COOKIE, token, demoSessionCookieOptions());
  stampAudit("demo_login", "session", "Demo workspace session started. Not a production credential.");
  redirect(isSafePath(next) ? next : "/dashboard");
}

export async function endDemoSession() {
  await clearCurrentAuth();
  redirect("/sign-out?done=1");
}

export async function expireIdleSession() {
  await clearCurrentAuth();
  redirect("/session-expired");
}

export async function requestPasswordReset(formData: FormData) {
  const headerList = await headers();
  const limited = rateLimit(clientKey(headerList, "reset"), 5, 15 * 60 * 1000);
  if (!limited.ok) {
    return { error: "Too many requests. Try again later.", locked: true };
  }
  const email = normalizeEmail(String(formData.get("email") || ""));
  stampAudit("password_reset_request", email ? "auth" : "auth", "Password reset requested. Existence of the account is not confirmed in the UI.");
  if (isSupabaseConfigured() && isAllowedOwnerEmail(email)) {
    const factory = createSupabaseServer();
    if (factory) {
      const supabase = await factory();
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
      });
    }
  }
  return { ok: true };
}

export async function submitContact(formData: FormData) {
  await assertSameOrigin();
  const headerList = await headers();
  const limited = rateLimit(clientKey(headerList, "contact"), 5, 60 * 60 * 1000);
  if (!limited.ok) {
    return { error: "Please wait before sending another message." };
  }

  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    businessName: formData.get("businessName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    service: formData.get("service"),
    audience: formData.get("audience") || "both",
    budget: formData.get("budget"),
    preferredContact: formData.get("preferredContact"),
    message: formData.get("message"),
    consent: formData.get("consent") === "on",
    companyWebsite: formData.get("companyWebsite"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  const file = formData.get("file");
  const fileName = file instanceof File && file.size > 0 ? file.name : null;
  if (file instanceof File && file.size > 0 && !allowedFile(file)) {
    return { error: "Upload a PDF or image up to 8MB." };
  }

  mutateWorkspace((state) => {
    state.contacts.unshift({
      id: `contact-${Date.now()}`,
      createdAt: new Date().toISOString(),
      name: sanitizeText(parsed.data.name),
      businessName: sanitizeText(parsed.data.businessName),
      email: parsed.data.email,
      phone: sanitizeText(parsed.data.phone),
      service: parsed.data.service,
      budget: parsed.data.budget,
      preferredContact: parsed.data.preferredContact,
      message: sanitizeText(parsed.data.message),
      consent: true,
      fileName,
      status: "new",
    });
    state.leads.unshift({
      id: `lead-${Date.now()}`,
      businessName: parsed.data.businessName || parsed.data.name,
      contactName: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      source: "Contact form",
      requestedService: parsed.data.service,
      estimatedValue: 0,
      probability: 10,
      stage: "new_inquiry",
      lastContact: null,
      nextFollowUp: new Date().toISOString().slice(0, 10),
      callsMade: 0,
      emailsSent: 0,
      meetings: 0,
      notes: `[Audience: ${parsed.data.audience}]\n${parsed.data.message}`,
      assignedTo: "Owner",
      createdAt: new Date().toISOString().slice(0, 10),
    });
  });
  stampAudit("contact_submitted", "leads", "Public contact form created a new inquiry.");
  revalidatePath("/dashboard/inbox");
  revalidatePath("/dashboard/leads");
  return { ok: true };
}

export async function reportVulnerability(formData: FormData) {
  await assertSameOrigin();
  const headerList = await headers();
  const limited = rateLimit(clientKey(headerList, "vuln"), 3, 60 * 60 * 1000);
  if (!limited.ok) {
    return { error: "Please wait before sending another report." };
  }
  const parsed = vulnerabilitySchema.safeParse({
    reporter: formData.get("reporter") || "",
    email: formData.get("email") || "",
    product: formData.get("product"),
    summary: formData.get("summary"),
    details: formData.get("details"),
    goodFaith: formData.get("goodFaith") === "on",
    companyWebsite: formData.get("companyWebsite"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }
  mutateWorkspace((state) => {
    state.securityEvents.unshift({
      id: `vuln-${Date.now()}`,
      at: new Date().toISOString(),
      type: "vulnerability_report",
      actor: parsed.data.email || "anonymous",
      detail: `${parsed.data.product}: ${sanitizeText(parsed.data.summary)}`,
    });
  });
  stampAudit(
    "vulnerability_report",
    "security",
    "A vulnerability report was filed. Details are not written to ordinary logs.",
  );
  revalidatePath("/dashboard/settings/security");
  return { ok: true };
}

export async function saveBrand(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  mutateWorkspace((state) => {
    state.brand.mission = sanitizeText(String(formData.get("mission") || state.brand.mission));
    state.brand.brandStatement = sanitizeText(String(formData.get("brandStatement") || state.brand.brandStatement));
    state.brand.legalName = sanitizeText(String(formData.get("legalName") || state.brand.legalName));
    state.brand.shortName = sanitizeText(String(formData.get("shortName") || state.brand.shortName));
    state.brand.founderName = sanitizeText(String(formData.get("founderName") || state.brand.founderName));
    state.brand.founderRole = sanitizeText(String(formData.get("founderRole") || state.brand.founderRole));
    state.brand.founderBio = sanitizeText(String(formData.get("founderBio") || state.brand.founderBio));
    state.brand.email = String(formData.get("email") || state.brand.email);
    state.brand.phone = sanitizeText(String(formData.get("phone") || ""));
    state.brand.calendlyUrl = String(formData.get("calendlyUrl") || "");
    state.brand.instagram = String(formData.get("instagram") || "");
    state.brand.linkedin = String(formData.get("linkedin") || "");
    state.brand.facebook = String(formData.get("facebook") || "");
    state.brand.tiktok = String(formData.get("tiktok") || "");
    const palette = getPalette(String(formData.get("paletteId") || state.brand.paletteId));
    state.brand.paletteId = palette.id;
    const accent = String(formData.get("accentColor") || palette.tokens.emerald);
    if (/^#[0-9A-Fa-f]{6}$/.test(accent)) state.brand.accentColor = accent;
  });
  stampAudit("brand_updated", "brand_settings", "Brand settings saved.");
  const jar = await cookies();
  jar.delete(PALETTE_COOKIE);
  revalidatePath("/", "layout");
  revalidatePath("/dashboard/settings/brand");
}

export async function previewPalette(formData: FormData) {
  await assertSameOrigin();
  const palette = getPalette(String(formData.get("paletteId") || ""));
  const jar = await cookies();
  jar.set(PALETTE_COOKIE, palette.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,
  });
  const next = String(formData.get("next") || "/");
  redirect(isSafePath(next) ? next : "/");
}

export async function clearPalettePreview() {
  const jar = await cookies();
  jar.delete(PALETTE_COOKIE);
  revalidatePath("/", "layout");
}

export async function saveCookieConsent() {
  const jar = await cookies();
  jar.set(CONSENT_COOKIE, "essential", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}

export async function saveLegalPage(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const id = String(formData.get("id"));
  const body = sanitizeText(String(formData.get("body") || ""));
  mutateWorkspace((state) => {
    const page = state.legal.find((item) => item.id === id);
    if (page) page.body = body;
  });
  stampAudit("legal_updated", id, "Legal placeholder copy updated. Still requires professional review.");
  revalidatePath("/legal");
}

export async function upsertExpense(input: Partial<Expense> & { id?: string }) {
  await assertSameOrigin();
  await requireOwnerWrite();
  mutateWorkspace((state) => {
    if (input.id) {
      const current = state.expenses.find((item) => item.id === input.id);
      if (current) {
        Object.assign(current, input, {
          totalAmount: Number(input.pretaxAmount ?? current.pretaxAmount) + Number(input.salesTax ?? current.salesTax),
          updatedAt: new Date().toISOString(),
        });
      }
    } else {
      const pretax = Number(input.pretaxAmount || 0);
      const tax = Number(input.salesTax || 0);
      state.expenses.unshift({
        id: `exp-${Date.now()}`,
        transactionDate: input.transactionDate || new Date().toISOString().slice(0, 10),
        postedDate: input.postedDate || input.transactionDate || new Date().toISOString().slice(0, 10),
        vendor: input.vendor || "Add vendor",
        description: input.description || "Add description",
        pretaxAmount: pretax,
        salesTax: tax,
        totalAmount: pretax + tax,
        currency: input.currency || "USD",
        category: input.category || "Needs review",
        subcategory: input.subcategory || "",
        clientId: input.clientId ?? null,
        projectId: input.projectId ?? null,
        businessPurpose: input.businessPurpose || "",
        paymentAccount: input.paymentAccount || "",
        paymentMethod: input.paymentMethod || "",
        recurring: Boolean(input.recurring),
        billingFrequency: input.billingFrequency || "one_time",
        receiptName: input.receiptName ?? null,
        receiptStatus: input.receiptStatus || "missing",
        reimbursable: Boolean(input.reimbursable),
        reimbursementStatus: input.reimbursementStatus || "n/a",
        directProjectCost: Boolean(input.directProjectCost),
        taxReviewStatus: input.taxReviewStatus || "needs_review",
        deductibilityStatus: input.deductibilityStatus || "unknown",
        taxYear: input.taxYear || new Date().getFullYear(),
        notes: input.notes || "",
        createdBy: "Owner",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        archived: false,
        confirmationStatus: input.confirmationStatus || "draft",
        demoLabel: true,
      });
    }
  });
  stampAudit("expense_upsert", input.id || "new", "Expense ledger updated.");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard");
}

export async function archiveExpenses(ids: string[]) {
  await assertSameOrigin();
  await requireOwnerWrite();
  mutateWorkspace((state) => {
    state.expenses.forEach((item) => {
      if (ids.includes(item.id)) item.archived = true;
    });
  });
  stampAudit("expense_archive", ids.join(","), "Expenses archived.");
  revalidatePath("/dashboard/expenses");
}

export async function deleteExpenses(ids: string[]) {
  await assertSameOrigin();
  await requireOwnerWrite();
  mutateWorkspace((state) => {
    state.expenses = state.expenses.filter((item) => !ids.includes(item.id));
  });
  stampAudit("expense_delete", ids.join(","), "Expenses deleted.");
  revalidatePath("/dashboard/expenses");
}

export async function duplicateExpense(id: string) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const source = getWorkspace().expenses.find((item) => item.id === id);
  if (!source) return;
  await upsertExpense({ ...source, id: undefined, description: `${source.description} (copy)` });
}

export async function upsertRevenue(input: Partial<RevenueEntry> & { id?: string }) {
  await assertSameOrigin();
  await requireOwnerWrite();
  mutateWorkspace((state) => {
    if (input.id) {
      const current = state.revenue.find((item) => item.id === input.id);
      if (current) Object.assign(current, input);
    } else {
      state.revenue.unshift({
        id: `rev-${Date.now()}`,
        date: input.date || new Date().toISOString().slice(0, 10),
        type: input.type || "one_time_project",
        description: input.description || "Add description",
        amount: Number(input.amount || 0),
        currency: "USD",
        clientId: input.clientId ?? null,
        projectId: input.projectId ?? null,
        service: input.service || "",
        invoiceStatus: input.invoiceStatus || "draft",
        paymentStatus: input.paymentStatus || "unpaid",
        dueDate: input.dueDate ?? null,
        stripeCustomerId: "",
        stripeSubscriptionId: "",
        recognized: Boolean(input.recognized),
        notes: input.notes || "",
        demoLabel: true,
      });
    }
  });
  stampAudit("revenue_upsert", input.id || "new", "Revenue ledger updated.");
  revalidatePath("/dashboard/revenue");
  revalidatePath("/dashboard");
}

export async function upsertLead(input: Partial<Lead> & { id?: string }) {
  await assertSameOrigin();
  await requireOwnerWrite();
  mutateWorkspace((state) => {
    if (input.id) {
      const current = state.leads.find((item) => item.id === input.id);
      if (current) Object.assign(current, input);
    } else {
      state.leads.unshift({
        id: `lead-${Date.now()}`,
        businessName: input.businessName || "New inquiry",
        contactName: input.contactName || "Add contact name",
        email: input.email || "",
        phone: input.phone || "",
        source: input.source || "Manual",
        requestedService: input.requestedService || "",
        estimatedValue: Number(input.estimatedValue || 0),
        probability: Number(input.probability || 10),
        stage: input.stage || "new_inquiry",
        lastContact: input.lastContact ?? null,
        nextFollowUp: input.nextFollowUp ?? null,
        callsMade: Number(input.callsMade || 0),
        emailsSent: Number(input.emailsSent || 0),
        meetings: Number(input.meetings || 0),
        notes: input.notes || "",
        assignedTo: input.assignedTo || "Owner",
        createdAt: new Date().toISOString().slice(0, 10),
      });
    }
  });
  stampAudit("lead_upsert", input.id || "new", "Lead updated.");
  revalidatePath("/dashboard/leads");
}

export async function upsertProject(input: Partial<Project> & { id?: string }) {
  await assertSameOrigin();
  await requireOwnerWrite();
  mutateWorkspace((state) => {
    if (input.id) {
      const current = state.projects.find((item) => item.id === input.id);
      if (current) Object.assign(current, input);
      return;
    }
    state.projects.unshift({
      id: `proj-${Date.now()}`,
      name: input.name || "New project",
      clientId: input.clientId || state.clients[0]?.id || "",
      packageId: input.packageId ?? null,
      stage: input.stage || "lead",
      startDate: input.startDate || new Date().toISOString().slice(0, 10),
      deadline: input.deadline || new Date().toISOString().slice(0, 10),
      budget: Number(input.budget || 0),
      amountInvoiced: Number(input.amountInvoiced || 0),
      amountCollected: Number(input.amountCollected || 0),
      directCost: Number(input.directCost || 0),
      githubRepo: input.githubRepo || "",
      vercelProject: input.vercelProject || "",
      productionUrl: input.productionUrl || "",
      domain: input.domain || "",
      maintenancePlan: input.maintenancePlan || "",
      credentialsReference: input.credentialsReference || "Stored outside this system. Record only the location of the vault, never the secret.",
      notes: input.notes || "",
      atRisk: Boolean(input.atRisk),
    });
  });
  stampAudit("project_upsert", input.id || "new", "Project updated.");
  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard");
}

export async function savePortfolio(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const id = String(formData.get("id"));
  mutateWorkspace((state) => {
    const item = state.portfolio.find((entry) => entry.id === id);
    if (!item) return;
    item.companyName = sanitizeText(String(formData.get("companyName") || item.companyName));
    item.industry = sanitizeText(String(formData.get("industry") || item.industry));
    item.projectTitle = sanitizeText(String(formData.get("projectTitle") || item.projectTitle));
    item.challenge = sanitizeText(String(formData.get("challenge") || item.challenge));
    item.solution = sanitizeText(String(formData.get("solution") || item.solution));
    item.websiteUrl = String(formData.get("websiteUrl") || "");
    const results = String(formData.get("results") || "").split("\n").map((line) => line.trim()).filter(Boolean);
    item.results = results.length ? results : ["Add verified result"];
  });
  stampAudit("portfolio_updated", id, "Portfolio item updated.");
  revalidatePath("/work");
  revalidatePath("/dashboard/portfolio");
}

export async function saveTestimonial(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  mutateWorkspace((state) => {
    const quote = sanitizeText(String(formData.get("quote") || ""));
    if (!quote) return;
    state.testimonials.unshift({
      id: `t-${Date.now()}`,
      authorName: sanitizeText(String(formData.get("authorName") || "Add name")),
      authorRole: sanitizeText(String(formData.get("authorRole") || "")),
      company: sanitizeText(String(formData.get("company") || "")),
      quote,
      approved: formData.get("approved") === "on",
      published: formData.get("published") === "on",
      source: "Owner entry",
      relatedPortfolioId: String(formData.get("relatedPortfolioId") || "") || null,
    });
  });
  revalidatePath("/dashboard/portfolio");
}

export async function toggleTheme(next: "light" | "dark") {
  const jar = await cookies();
  jar.set("sts_theme", next, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/");
}

export async function signInWithPassword(formData: FormData) {
  await assertSameOrigin();
  const headerList = await headers();
  const limited = rateLimit(clientKey(headerList, "login"), 8, 15 * 60 * 1000);
  if (!limited.ok) {
    return { error: "Too many attempts. Try again later.", locked: true };
  }
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured. Use demo workspace locally, or add environment variables." };
  }
  const factory = createSupabaseServer();
  if (!factory) return { error: "Supabase is not configured." };
  const supabase = await factory();
  const email = normalizeEmail(String(formData.get("email") || ""));
  const password = String(formData.get("password") || "");
  if (!isAllowedOwnerEmail(email)) {
    stampAudit("login_failed", "auth", "Failed password sign-in. Email existence is not confirmed in the UI.");
    return { error: GENERIC_AUTH_ERROR };
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    stampAudit("login_failed", "auth", "Failed password sign-in. Email existence is not confirmed in the UI.");
    return { error: GENERIC_AUTH_ERROR };
  }
  stampAudit("login_success", "auth", "Password sign-in succeeded.");
  const next = String(formData.get("next") || "/dashboard");
  redirect(isSafeRedirect(next) ? next : "/dashboard");
}

export async function requestOtp(formData: FormData) {
  const limited = rateLimit(clientKey(await headers(), "otp"), 5, 15 * 60 * 1000);
  if (!limited.ok) return { error: "Please wait before requesting another code.", locked: true };
  const email = normalizeEmail(String(formData.get("email") || ""));
  if (!isSupabaseConfigured() || !isAllowedOwnerEmail(email)) {
    return { sent: true, demo: !isSupabaseConfigured() };
  }
  const factory = createSupabaseServer();
  if (!factory) return { sent: true, demo: true };
  const supabase = await factory();
  await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  return { sent: true };
}

export async function requestMagicLink(formData: FormData) {
  const limited = rateLimit(clientKey(await headers(), "magic"), 5, 15 * 60 * 1000);
  if (!limited.ok) return { error: "Please wait before requesting another link.", locked: true };
  const email = normalizeEmail(String(formData.get("email") || ""));
  if (!isSupabaseConfigured() || !isAllowedOwnerEmail(email)) {
    return { sent: true, demo: !isSupabaseConfigured() };
  }
  const factory = createSupabaseServer();
  if (!factory) return { sent: true, demo: true };
  const supabase = await factory();
  await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });
  return { sent: true };
}

export async function saveBusinessProfile(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  mutateWorkspace((state) => {
    const current = state.businessProfile;
    const next: BusinessProfile = {
      ...current,
      legalName: sanitizeText(String(formData.get("legalName") || current.legalName)),
      dba: sanitizeText(String(formData.get("dba") || current.dba)),
      entityType: (String(formData.get("entityType") || current.entityType) as BusinessProfile["entityType"]),
      federalClassification: (String(formData.get("federalClassification") || current.federalClassification) as BusinessProfile["federalClassification"]),
      formationState: sanitizeText(String(formData.get("formationState") || current.formationState)),
      accountingMethod: (String(formData.get("accountingMethod") || current.accountingMethod) as BusinessProfile["accountingMethod"]),
      fiscalYearType: (String(formData.get("fiscalYearType") || current.fiscalYearType) as BusinessProfile["fiscalYearType"]),
      fiscalYearStartMonth: Number(formData.get("fiscalYearStartMonth") || current.fiscalYearStartMonth) || 1,
      timezone: String(formData.get("timezone") || current.timezone),
      currency: String(formData.get("currency") || current.currency),
      website: String(formData.get("website") || current.website),
      publicEmail: String(formData.get("publicEmail") || current.publicEmail),
      ownerEmail: current.ownerEmail,
      taxReservePercent: Number(formData.get("taxReservePercent") || 0),
      reservedTaxAmountCents: parseDollarsToCents(String(formData.get("reservedTaxAmount") || "0")),
      invoiceNumberFormat: sanitizeText(String(formData.get("invoiceNumberFormat") || current.invoiceNumberFormat)),
      defaultPaymentTerms: sanitizeText(String(formData.get("defaultPaymentTerms") || current.defaultPaymentTerms)),
      defaultDepositPercent: Number(formData.get("defaultDepositPercent") || 0),
      sCorpStatus: (String(formData.get("sCorpStatus") || current.sCorpStatus) as BusinessProfile["sCorpStatus"]),
      sCorpNotes: current.sCorpNotes,
      einStored: false,
      notes: sanitizeText(String(formData.get("notes") || current.notes)),
    };
    state.businessProfile = next;
  });
  stampAudit("business_profile_updated", "business_profile", "Business profile saved. EIN is not stored.");
  revalidatePath("/dashboard/settings/business");
  revalidatePath("/dashboard/taxes");
  revalidatePath("/dashboard");
}

export async function upsertClient(input: Partial<ClientRecord> & { id?: string }) {
  await assertSameOrigin();
  await requireOwnerWrite();
  mutateWorkspace((state) => {
    if (input.id) {
      const current = state.clients.find((item) => item.id === input.id);
      if (current) Object.assign(current, input, { portalEnabled: false });
      return;
    }
    state.clients.unshift({
      id: `client-${Date.now()}`,
      businessName: input.businessName || "New client",
      contactName: input.contactName || "Add contact name",
      email: input.email || "",
      phone: input.phone || "",
      industry: input.industry || "",
      status: input.status || "active",
      portalEnabled: false,
      notes: input.notes || "",
    });
  });
  stampAudit("client_upsert", input.id || "new", "Client record saved. Clients do not receive a login.");
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard");
}

export async function saveClientForm(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const id = String(formData.get("id") || "");
  await upsertClient({
    id: id || undefined,
    businessName: sanitizeText(String(formData.get("businessName") || "")),
    contactName: sanitizeText(String(formData.get("contactName") || "")),
    email: String(formData.get("email") || ""),
    phone: sanitizeText(String(formData.get("phone") || "")),
    industry: sanitizeText(String(formData.get("industry") || "")),
    status: (String(formData.get("status") || "active") as ClientRecord["status"]),
    notes: sanitizeText(String(formData.get("notes") || "")),
  });
}

export async function upsertTask(input: Partial<TaskItem> & { id?: string }) {
  await assertSameOrigin();
  await requireOwnerWrite();
  mutateWorkspace((state) => {
    if (input.id) {
      const current = state.tasks.find((item) => item.id === input.id);
      if (current) Object.assign(current, input);
      return;
    }
    state.tasks.unshift({
      id: `task-${Date.now()}`,
      title: input.title || "New task",
      projectId: input.projectId ?? null,
      clientId: input.clientId ?? null,
      dueDate: input.dueDate ?? null,
      status: input.status || "todo",
      priority: input.priority || "medium",
      assignee: input.assignee || "Owner",
      notes: input.notes || "",
    });
  });
  stampAudit("task_upsert", input.id || "new", "Task saved.");
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard");
}

export async function saveTaskForm(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const id = String(formData.get("id") || "");
  const projectId = String(formData.get("projectId") || "");
  const clientId = String(formData.get("clientId") || "");
  await upsertTask({
    id: id || undefined,
    title: sanitizeText(String(formData.get("title") || "")),
    projectId: projectId || null,
    clientId: clientId || null,
    dueDate: String(formData.get("dueDate") || "") || null,
    status: (String(formData.get("status") || "todo") as TaskItem["status"]),
    priority: (String(formData.get("priority") || "medium") as TaskItem["priority"]),
    assignee: sanitizeText(String(formData.get("assignee") || "Owner")),
    notes: sanitizeText(String(formData.get("notes") || "")),
  });
}

export async function saveProjectForm(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const id = String(formData.get("id") || "");
  await upsertProject({
    id: id || undefined,
    name: sanitizeText(String(formData.get("name") || "")),
    clientId: String(formData.get("clientId") || ""),
    stage: (String(formData.get("stage") || "lead") as Project["stage"]),
    startDate: String(formData.get("startDate") || new Date().toISOString().slice(0, 10)),
    deadline: String(formData.get("deadline") || ""),
    budget: Number(formData.get("budget") || 0),
    notes: sanitizeText(String(formData.get("notes") || "")),
    atRisk: formData.get("atRisk") === "on",
  });
}

export async function saveNoteForm(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const id = String(formData.get("id") || "");
  mutateWorkspace((state) => {
    const current = id ? state.notes.find((item) => item.id === id) : undefined;
    const relationship = resolveNoteRelationship(formData, current);
    const payload: OwnerNote = {
      id: id || `note-${Date.now()}`,
      title: sanitizeText(String(formData.get("title") || "Untitled note")),
      body: sanitizeText(String(formData.get("body") || "")),
      relatedType: relationship.relatedType,
      relatedId: relationship.relatedId,
      pinned: formData.get("pinned") === "on",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (id) {
      if (current) Object.assign(current, payload, { createdAt: current.createdAt });
    } else {
      state.notes.unshift(payload);
    }
  });
  stampAudit("note_upsert", id || "new", "Note saved.");
  revalidatePath("/dashboard/notes");
}

export async function uploadExpenseReceipt(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const expenseId = String(formData.get("expenseId") || "");
  const file = formData.get("file");
  const upload = file instanceof File ? file : null;
  const validationError = uploadFileError(upload);
  if (!expenseId) {
    return { error: "Choose an expense before attaching a receipt." };
  }
  if (validationError) {
    return { error: validationError };
  }
  if (!isObjectStorageConfigured()) {
    stampAudit("receipt_upload_blocked", expenseId, "Receipt upload blocked because private storage is not configured.");
    return { error: STORAGE_NOT_CONFIGURED_MESSAGE, status: "storage_not_configured" as const };
  }
  const factory = createSupabaseServer();
  if (!factory || !upload) {
    stampAudit("receipt_upload_blocked", expenseId, "Receipt upload blocked because private storage is not configured.");
    return { error: STORAGE_NOT_CONFIGURED_MESSAGE, status: "storage_not_configured" as const };
  }
  const supabase = await factory();
  const path = `${expenseId}/${Date.now()}-${safeUploadFileName(upload.name)}`;
  const { error } = await supabase.storage.from("receipts").upload(path, upload, { upsert: false });
  if (error) {
    stampAudit("receipt_upload_failed", expenseId, "Receipt upload failed. The file was not marked attached.");
    return { error: "The receipt could not be stored.", status: "storage_failed" as const };
  }
  mutateWorkspace((state) => {
    applyPrivateReceiptAttachment(state, expenseId, upload.name);
  });
  stampAudit("receipt_upload", expenseId, "Private receipt metadata stored after object storage accepted the file.");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/files");
  return { ok: true as const };
}

export async function completePasswordReset(formData: FormData) {
  await assertSameOrigin();
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  if (password !== confirm || !passwordScore(password).ok) {
    return { error: "The password does not meet the policy or the confirmation does not match." };
  }
  const flow = await verifiedRecoveryFlow();
  if (!flow.allowForm) {
    return { error: flow.heading === NOT_CONFIGURED_MESSAGE ? NOT_CONFIGURED_MESSAGE : flow.message, status: flow.status };
  }
  const factory = createSupabaseServer();
  if (!factory) return { error: NOT_CONFIGURED_MESSAGE, status: "not_configured" as const };
  const supabase = await factory();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    stampAudit("password_reset_rejected", "auth", "Password reset rejected. No secret was logged.");
    return { error: "This reset link is missing, invalid, or expired.", status: "invalid" as const };
  }
  stampAudit("password_reset_completed", "auth", "Password reset completed after a server-verified recovery session.");
  return { ok: true as const };
}

export async function acceptInvitation(formData: FormData) {
  await assertSameOrigin();
  const password = String(formData.get("password") || "");
  if (!passwordScore(password).ok) {
    return { error: "The password does not meet the policy." };
  }
  const flow = await verifiedRecoveryFlow();
  if (!flow.allowForm) {
    return { error: flow.heading === NOT_CONFIGURED_MESSAGE ? NOT_CONFIGURED_MESSAGE : flow.message, status: flow.status };
  }
  const factory = createSupabaseServer();
  if (!factory) return { error: NOT_CONFIGURED_MESSAGE, status: "not_configured" as const };
  const supabase = await factory();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    stampAudit("invite_rejected", "auth", "Invitation rejected. No secret was logged.");
    return { error: "This invitation is missing, invalid, or expired.", status: "invalid" as const };
  }
  stampAudit("invite_accepted", "auth", "Invitation accepted after a server-verified invite session.");
  return { ok: true as const };
}

export async function verifyMfaCode(formData: FormData) {
  await assertSameOrigin();
  const code = String(formData.get("code") || "");
  const attempt = describeMfaAttempt({
    code,
    demoMode: isDemoModeEnabled(),
    backendConfigured: isSupabaseConfigured(),
    production: process.env.NODE_ENV === "production",
    verifiedByProvider: false,
  });
  if (!attempt.ok || !attempt.grantOwnerSession) {
    stampAudit("mfa_rejected", "auth", "MFA challenge rejected. No code was logged.");
    return { error: attempt.message, status: attempt.status, grantOwnerSession: false as const };
  }
  return { error: NOT_CONFIGURED_MESSAGE, status: "not_configured" as const, grantOwnerSession: false as const };
}

export async function verifyEmailCode(formData: FormData) {
  await assertSameOrigin();
  const code = String(formData.get("code") || "");
  const email = normalizeEmail(String(formData.get("email") || ""));
  if (!isSupabaseConfigured()) {
    return { error: NOT_CONFIGURED_MESSAGE, status: "not_configured" as const };
  }
  if (!code) return { error: "Missing token", status: "missing" as const };
  if (looksForgedToken(code)) return { error: "Invalid token", status: "forged" as const };
  if (!/^\d{6,8}$/.test(code)) return { error: "Invalid token", status: "invalid" as const };
  if (!isAllowedOwnerEmail(email)) {
    stampAudit("otp_rejected", "auth", "Email code rejected. No code was logged.");
    return { error: GENERIC_AUTH_ERROR, status: "invalid" as const };
  }
  const factory = createSupabaseServer();
  if (!factory) return { error: NOT_CONFIGURED_MESSAGE, status: "not_configured" as const };
  const supabase = await factory();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: "email",
  });
  if (error) {
    stampAudit("otp_rejected", "auth", "Email code rejected. No code was logged.");
    return { error: "This code is missing, invalid, or expired.", status: "invalid" as const };
  }
  stampAudit("otp_verified", "auth", "Email code verified.");
  redirect("/dashboard");
}

async function verifiedRecoveryFlow() {
  const backendConfigured = isSupabaseConfigured();
  let hasServerVerifiedSession = false;
  if (backendConfigured) {
    const factory = createSupabaseServer();
    if (factory) {
      const supabase = await factory();
      const { data } = await supabase.auth.getUser();
      hasServerVerifiedSession = Boolean(data.user);
    }
  }
  return describeAuthFlowState({
    backendConfigured,
    hasServerVerifiedSession,
    production: process.env.NODE_ENV === "production",
  });
}

export async function saveDocumentForm(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const file = formData.get("file");
  const fileName = file instanceof File && file.size > 0 ? file.name : null;
  if (file instanceof File && file.size > 0 && !allowedFile(file)) {
    return { error: "Upload a PDF or image up to 8MB." };
  }
  mutateWorkspace((state) => {
    const item: OsDocument = {
      id: `doc-${Date.now()}`,
      name: sanitizeText(String(formData.get("name") || fileName || "Untitled document")),
      category: (String(formData.get("category") || "other") as OsDocument["category"]),
      relatedType: (String(formData.get("relatedType") || "none") as OsDocument["relatedType"]),
      relatedId: String(formData.get("relatedId") || "") || null,
      notes: sanitizeText(String(formData.get("notes") || "")),
      storagePath: fileName,
      createdAt: new Date().toISOString(),
    };
    state.osDocuments.unshift(item);
    if (fileName) {
      state.files.unshift({
        id: `f-${Date.now()}`,
        name: fileName,
        kind: "internal",
        relatedTo: item.id,
        visibility: "private",
        uploadedAt: item.createdAt,
      });
    }
  });
  stampAudit("document_created", "documents", "Document metadata saved. Files stay private.");
  revalidatePath("/dashboard/documents");
  revalidatePath("/dashboard/files");
  return { ok: true };
}

export async function saveOsTransactionForm(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const kind = String(formData.get("kind") || "adjustment") as OsTransaction["kind"];
  const dollars = Number(formData.get("amount") || 0);
  const cents = parseDollarsToCents(dollars);
  const signed =
    kind === "expense" || kind === "owner_draw" ? -Math.abs(cents) : kind === "transfer" ? cents : Math.abs(cents);
  mutateWorkspace((state) => {
    state.osTransactions.unshift({
      id: `txn-${Date.now()}`,
      date: String(formData.get("date") || new Date().toISOString().slice(0, 10)),
      kind,
      source: "manual",
      sourceId: null,
      description: sanitizeText(String(formData.get("description") || "Manual entry")),
      amountCents: signed,
      currency: state.businessProfile.currency,
      clientId: String(formData.get("clientId") || "") || null,
      projectId: String(formData.get("projectId") || "") || null,
      category: sanitizeText(String(formData.get("category") || "")),
      notes: sanitizeText(String(formData.get("notes") || "")),
      archived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });
  stampAudit("os_transaction_created", "transactions", "Manual transaction posted in integer cents.");
  revalidatePath("/dashboard/transactions");
}

export async function archiveOsTransaction(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const id = String(formData.get("id") || "");
  mutateWorkspace((state) => {
    const item = state.osTransactions.find((row) => row.id === id);
    if (item) item.archived = true;
  });
  stampAudit("os_transaction_archived", id, "Manual transaction archived rather than deleted.");
  revalidatePath("/dashboard/transactions");
}

export async function saveTaxChecklistItem(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const id = String(formData.get("id") || "");
  mutateWorkspace((state) => {
    if (id) {
      const current = state.taxChecklist.find((item) => item.id === id);
      if (current) {
        current.status = String(formData.get("status") || current.status) as TaxChecklistItem["status"];
        current.notes = sanitizeText(String(formData.get("notes") || current.notes));
      }
      return;
    }
    state.taxChecklist.unshift({
      id: `tax-${Date.now()}`,
      taxYear: Number(formData.get("taxYear") || new Date().getFullYear()),
      title: sanitizeText(String(formData.get("title") || "Owner reminder")),
      notes: sanitizeText(String(formData.get("notes") || "")),
      dueDate: String(formData.get("dueDate") || "") || null,
      status: "todo",
      ownerEntered: true,
    });
  });
  stampAudit("tax_checklist_updated", id || "new", "Tax checklist updated. Not tax advice.");
  revalidatePath("/dashboard/taxes");
}

export async function saveDashboardPreferences(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const hidden = String(formData.get("hiddenCards") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  mutateWorkspace((state) => {
    state.dashboardPreferences.hiddenCards = hidden;
  });
  stampAudit("dashboard_preferences", "overview", "Command Center card visibility updated.");
  revalidatePath("/dashboard");
}

export async function createQuickRecord(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const kind = String(formData.get("kind") || "");
  if (kind === "lead") {
    await upsertLead({ businessName: "New inquiry (draft)", notes: "Created from Command Center" });
    return;
  }
  if (kind === "client") {
    await upsertClient({ businessName: "New client (draft)", notes: "Created from Command Center" });
    return;
  }
  if (kind === "project") {
    await upsertProject({ name: "New project (draft)", notes: "Created from Command Center" });
    return;
  }
  if (kind === "task") {
    await upsertTask({ title: "New task (draft)", notes: "Created from Command Center" });
    return;
  }
  if (kind === "note") {
    const data = new FormData();
    data.set("title", "Quick note");
    data.set("body", "Created from Command Center");
    await saveNoteForm(data);
  }
}


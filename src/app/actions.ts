"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { CONSENT_COOKIE, DEMO_COOKIE, PALETTE_COOKIE, THEME_COOKIE, isDemoModeEnabled, isObjectStorageConfigured, isSupabaseConfigured } from "@/lib/config";
import { getWorkspace, mutateWorkspace, stampAudit } from "@/lib/data/store";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";
import { allowedFile, assertSameOrigin } from "@/lib/security/origin";
import { documentUploadError, sniffDocumentContentType, uploadFileError, safeUploadFileName } from "@/lib/security/files";
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
  CalendarEvent,
  EventKind,
  OsDocument,
  OsTransaction,
  OwnerNote,
  Project,
  RevenueEntry,
  TaskItem,
  TaxChecklistItem,
  WorkspaceEstimate,
  WorkspaceEstimateStatus,
} from "@/lib/types";
import { isSafeRedirect } from "@/lib/utils";
import { contactSchema, sanitizeText, vulnerabilitySchema } from "@/lib/validation";
import { clearCurrentAuth, createSupabaseServer, getSession, organizationRoleFor, requireBusinessSettingsWrite, requireCrmWrite, requireEstimateWrite, requireFinanceWrite, requireInvoiceWrite, requireOperationsWrite, requireOwnerWrite, requireRevenueWrite, sessionOrganizationId } from "@/lib/auth/session";
import { recordOrganizationAudit, updateOrganizationBusinessSettings } from "@/lib/org/store";
import { saveOrganizationSettingsInDatabase } from "@/lib/org/database";
import {
  GENERIC_CRM_ERROR,
  loadCrmLeadFromDatabase,
  normalizeClientInput,
  normalizeLeadInput,
  saveCrmClientInDatabase,
  saveCrmLeadInDatabase,
  shouldUseCrmDatabase,
} from "@/lib/org/crm";
import {
  archiveOpsExpenseInDatabase,
  archiveOpsProjectInDatabase,
  archiveOpsRevenueInDatabase,
  archiveOpsTaskInDatabase,
  GENERIC_OPS_ERROR,
  loadOpsExpense,
  loadOpsProject,
  loadOpsRevenue,
  loadOpsTask,
  normalizeExpenseInput,
  normalizeRevenueInput,
  saveOpsExpenseInDatabase,
  saveOpsProjectInDatabase,
  saveOpsRevenueInDatabase,
  saveOpsTaskInDatabase,
  shouldUseOpsDatabase,
} from "@/lib/org/operations";
import { draftBusinessSettings, GENERIC_SETTINGS_ERROR, parseBusinessSettingsForm } from "@/lib/org/settings";
import { demoSessionCookieOptions, getDemoSessionSecret, signDemoSession } from "@/lib/auth/demo-session";
import { GENERIC_AUTH_ERROR, normalizeEmail } from "@/lib/auth/owner";
import { parseDollarsToCents } from "@/lib/money";
import {
  DOCUMENT_CATEGORIES,
  EVENT_KINDS,
  EVENT_TIMEZONES,
  GENERIC_WORKSPACE_ERROR,
  ORG_DOCUMENTS_BUCKET,
  archiveWorkspaceDocument,
  archiveWorkspaceEvent,
  archiveWorkspaceInvoice,
  archiveWorkspaceNote,
  computeInvoiceTotals,
  convertEstimateToInvoice,
  generatedDocumentPath,
  isPersistedWorkspaceId,
  issueWorkspaceInvoice,
  loadWorkspaceDocument,
  loadWorkspaceEvent,
  loadWorkspaceNote,
  newDocumentId,
  parseCalendarBounds,
  parseInvoiceLinesFromForm,
  recordWorkspaceInvoicePayment,
  reconcileWorkspaceSchedule,
  saveWorkspaceDocument,
  saveWorkspaceEvent,
  saveWorkspaceInvoice,
  saveWorkspaceNote,
  shouldUseWorkspaceDatabase,
  startProjectFromInvoice,
  validateInvoiceLines,
  voidWorkspaceInvoice,
} from "@/lib/org/workspace";
import {
  GENERIC_CONVERT_ERROR,
  GENERIC_ESTIMATE_ERROR,
  archiveWorkspaceEstimate,
  canConvertEstimateToInvoice,
  canTransitionEstimateStatus,
  computeEstimateTotals,
  draftInvoiceFromAcceptedEstimate,
  parseEstimateLinesFromForm,
  restoreWorkspaceEstimate,
  saveWorkspaceEstimate,
  setWorkspaceEstimateStatus,
  shouldUseEstimateDatabase,
  validateEstimateLines,
} from "@/lib/org/estimates";
import {
  disableClientPortalIdentity,
  linkClientPortalIdentity,
  publishClientPortalRecord,
  unpublishClientPortalRecord,
} from "@/lib/org/client-portal";
import { isClientPortalSourceType } from "@/lib/org/client-portal-model";
import {
  canStartProjectFromInvoice,
  draftProjectFromConvertedInvoice,
} from "@/lib/org/schedule-model";

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
  if (isSupabaseConfigured() && email) {
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
  const session = await getSession();
  if (shouldUseOpsDatabase(session.user)) {
    const write = await requireFinanceWrite();
    const factory = createSupabaseServer();
    if (!factory) throw new Error(GENERIC_OPS_ERROR);
    const supabase = await factory();
    const current = input.id ? await loadOpsExpense(supabase, write.organizationId, input.id) : null;
    const payload = normalizeExpenseInput(input, current);
    const saved = await saveOpsExpenseInDatabase(supabase, write.organizationId, payload);
    if ("error" in saved) throw new Error(GENERIC_OPS_ERROR);
    stampAudit("expense_upsert", saved.id, "Expense ledger updated.");
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard");
    return;
  }
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
  const session = await getSession();
  if (shouldUseOpsDatabase(session.user)) {
    const write = await requireFinanceWrite();
    const factory = createSupabaseServer();
    if (!factory) throw new Error(GENERIC_OPS_ERROR);
    const supabase = await factory();
    for (const id of ids) {
      const saved = await archiveOpsExpenseInDatabase(supabase, write.organizationId, id);
      if ("error" in saved) throw new Error(GENERIC_OPS_ERROR);
    }
    stampAudit("expense_archive", ids.join(","), "Expenses archived.");
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard");
    return;
  }
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
  const session = await getSession();
  if (shouldUseOpsDatabase(session.user)) {
    // Organization ledgers have no authenticated hard-delete path.
    await archiveExpenses(ids);
    return;
  }
  mutateWorkspace((state) => {
    state.expenses = state.expenses.filter((item) => !ids.includes(item.id));
  });
  stampAudit("expense_delete", ids.join(","), "Expenses deleted.");
  revalidatePath("/dashboard/expenses");
}

export async function duplicateExpense(id: string) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const session = await getSession();
  if (shouldUseOpsDatabase(session.user)) {
    const write = await requireFinanceWrite();
    const factory = createSupabaseServer();
    if (!factory) throw new Error(GENERIC_OPS_ERROR);
    const supabase = await factory();
    const source = await loadOpsExpense(supabase, write.organizationId, id);
    if (!source) return;
    await upsertExpense({ ...source, id: undefined, description: `${source.description} (copy)` });
    return;
  }
  const source = getWorkspace().expenses.find((item) => item.id === id);
  if (!source) return;
  await upsertExpense({ ...source, id: undefined, description: `${source.description} (copy)` });
}

export async function upsertRevenue(input: Partial<RevenueEntry> & { id?: string; paymentMethod?: string; paidDate?: string | null; invoiceNumber?: string }) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const session = await getSession();
  if (shouldUseOpsDatabase(session.user)) {
    const write = await requireRevenueWrite();
    const factory = createSupabaseServer();
    if (!factory) throw new Error(GENERIC_OPS_ERROR);
    const supabase = await factory();
    const current = input.id ? await loadOpsRevenue(supabase, write.organizationId, input.id) : null;
    const payload = normalizeRevenueInput(input, current);
    const saved = await saveOpsRevenueInDatabase(supabase, write.organizationId, payload, {
      paymentMethod: input.paymentMethod,
      paidDate: input.paidDate,
      invoiceNumber: input.invoiceNumber,
      recurring: input.type === "recurring_maintenance",
    });
    if ("error" in saved) throw new Error(GENERIC_OPS_ERROR);
    stampAudit("revenue_upsert", saved.id, "Revenue ledger updated.");
    revalidatePath("/dashboard/revenue");
    revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard");
    return;
  }
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
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard");
}

export async function archiveRevenue(id: string) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const session = await getSession();
  if (shouldUseOpsDatabase(session.user)) {
    const write = await requireRevenueWrite();
    const factory = createSupabaseServer();
    if (!factory) throw new Error(GENERIC_OPS_ERROR);
    const supabase = await factory();
    const saved = await archiveOpsRevenueInDatabase(supabase, write.organizationId, id);
    if ("error" in saved) throw new Error(GENERIC_OPS_ERROR);
    stampAudit("revenue_archive", id, "Revenue archived.");
    revalidatePath("/dashboard/revenue");
    revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard");
    return;
  }
  mutateWorkspace((state) => {
    state.revenue = state.revenue.filter((item) => item.id !== id);
  });
  stampAudit("revenue_archive", id, "Revenue archived.");
  revalidatePath("/dashboard/revenue");
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard");
}

export async function upsertLead(input: Partial<Lead> & { id?: string }) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const session = await getSession();
  if (shouldUseCrmDatabase(session.user)) {
    const write = await requireCrmWrite();
    const factory = createSupabaseServer();
    if (!factory) throw new Error(GENERIC_CRM_ERROR);
    const supabase = await factory();
    const current = input.id ? await loadCrmLeadFromDatabase(supabase, write.organizationId, input.id) : null;
    const payload = normalizeLeadInput(input, current);
    const saved = await saveCrmLeadInDatabase(supabase, write.organizationId, payload);
    if ("error" in saved) throw new Error(GENERIC_CRM_ERROR);
    stampAudit("lead_upsert", saved.id, "Lead updated.");
    revalidatePath("/dashboard/leads");
    return;
  }
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
  const session = await getSession();
  if (shouldUseOpsDatabase(session.user)) {
    const write = await requireOperationsWrite();
    const factory = createSupabaseServer();
    if (!factory) throw new Error(GENERIC_OPS_ERROR);
    const supabase = await factory();
    const current = input.id ? await loadOpsProject(supabase, write.organizationId, input.id) : null;
    const payload: Project = {
      id: input.id || current?.id || "",
      name: input.name || current?.name || "New project",
      clientId: input.clientId ?? current?.clientId ?? "",
      packageId: input.packageId ?? current?.packageId ?? null,
      stage: input.stage || current?.stage || "lead",
      startDate: input.startDate || current?.startDate || new Date().toISOString().slice(0, 10),
      deadline: input.deadline || current?.deadline || "",
      budget: Number(input.budget ?? current?.budget ?? 0),
      amountInvoiced: Number(input.amountInvoiced ?? current?.amountInvoiced ?? 0),
      amountCollected: Number(input.amountCollected ?? current?.amountCollected ?? 0),
      directCost: Number(input.directCost ?? current?.directCost ?? 0),
      githubRepo: current?.githubRepo || "",
      vercelProject: current?.vercelProject || "",
      productionUrl: current?.productionUrl || "",
      domain: current?.domain || "",
      maintenancePlan: current?.maintenancePlan || "",
      credentialsReference: current?.credentialsReference || "Stored outside this system. Record only the location of the vault, never the secret.",
      notes: input.notes ?? current?.notes ?? "",
      atRisk: Boolean(input.atRisk ?? current?.atRisk),
    };
    const saved = await saveOpsProjectInDatabase(supabase, write.organizationId, payload);
    if ("error" in saved) throw new Error(GENERIC_OPS_ERROR);
    stampAudit("project_upsert", saved.id, "Project updated.");
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard");
    return;
  }
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

export async function archiveProject(id: string) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const session = await getSession();
  if (shouldUseOpsDatabase(session.user)) {
    const write = await requireOperationsWrite();
    const factory = createSupabaseServer();
    if (!factory) throw new Error(GENERIC_OPS_ERROR);
    const supabase = await factory();
    const saved = await archiveOpsProjectInDatabase(supabase, write.organizationId, id);
    if ("error" in saved) throw new Error(GENERIC_OPS_ERROR);
    stampAudit("project_archive", id, "Project archived.");
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard");
    return;
  }
  mutateWorkspace((state) => {
    state.projects = state.projects.filter((item) => item.id !== id);
  });
  stampAudit("project_archive", id, "Project archived.");
  revalidatePath("/dashboard/projects");
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
  jar.set(THEME_COOKIE, next === "dark" ? "dark" : "light", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });
  revalidatePath("/", "layout");
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
  if (!email || !password) {
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
  if (!isSupabaseConfigured() || !email) {
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
  if (!isSupabaseConfigured() || !email) {
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

export type BusinessSettingsActionState = {
  ok?: boolean;
  error?: string;
  values?: import("@/lib/org/types").BusinessSettingsInput;
};

export async function saveBusinessOsSettings(
  _prev: BusinessSettingsActionState,
  formData: FormData,
): Promise<BusinessSettingsActionState> {
  await assertSameOrigin();
  await requireOwnerWrite();
  const session = await requireBusinessSettingsWrite();
  const parsed = parseBusinessSettingsForm(formData);
  if (!parsed.success) {
    return { error: parsed.error, values: draftBusinessSettings(formData) };
  }

  const user = session.user!;
  const organizationId = session.organizationId ?? sessionOrganizationId(user);
  const actorRole = organizationRoleFor(user);
  if (!organizationId || !actorRole || user.membershipStatus !== "active") {
    return { error: GENERIC_SETTINGS_ERROR, values: parsed.data };
  }

  if (user.source === "supabase") {
    if (!isSupabaseConfigured()) {
      return { error: GENERIC_SETTINGS_ERROR, values: parsed.data };
    }
    try {
      const factory = createSupabaseServer();
      if (!factory) return { error: GENERIC_SETTINGS_ERROR, values: parsed.data };
      const supabase = await factory();
      const saved = await saveOrganizationSettingsInDatabase(supabase, organizationId, parsed.data);
      if ("error" in saved) {
        return { error: GENERIC_SETTINGS_ERROR, values: parsed.data };
      }
      revalidatePath("/dashboard/settings/business");
      revalidatePath("/dashboard");
      return { ok: true };
    } catch {
      return { error: GENERIC_SETTINGS_ERROR, values: parsed.data };
    }
  }

  if (user.source !== "demo" || !isDemoModeEnabled()) {
    return { error: GENERIC_SETTINGS_ERROR, values: parsed.data };
  }

  try {
    updateOrganizationBusinessSettings({
      organizationId,
      actorUserId: user.id,
      actorRole,
      actorStatus: user.membershipStatus,
      actorOrganizationId: organizationId,
      values: parsed.data,
    });
    mutateWorkspace((state) => {
      state.businessProfile = {
        ...state.businessProfile,
        legalName: parsed.data.legalName,
        dba: parsed.data.displayName,
        timezone: parsed.data.timezone,
        currency: parsed.data.baseCurrency,
        fiscalYearStartMonth: parsed.data.fiscalYearStart,
        defaultPaymentTerms: parsed.data.defaultPaymentTerms,
        einStored: false,
      };
    });
    stampAudit(
      "business_settings_updated",
      "business_settings",
      "Organization business settings saved. Prefixes apply to new documents only. EIN is not stored.",
    );
    revalidatePath("/dashboard/settings/business");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch {
    recordOrganizationAudit({
      organizationId,
      actorUserId: user.id,
      action: "business_settings.update_failed",
      result: "failure",
      entityType: "business_settings",
      entityId: null,
      metadata: {
        result: "failure",
        note: "Settings were not saved. Prefixes were not applied to historical documents.",
      },
    });
    return { error: GENERIC_SETTINGS_ERROR, values: parsed.data };
  }
}

export async function upsertClient(input: Partial<ClientRecord> & { id?: string }) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const session = await getSession();
  const payload = normalizeClientInput(input);
  if (shouldUseCrmDatabase(session.user)) {
    const write = await requireCrmWrite();
    const factory = createSupabaseServer();
    if (!factory) throw new Error(GENERIC_CRM_ERROR);
    const supabase = await factory();
    const saved = await saveCrmClientInDatabase(supabase, write.organizationId, payload);
    if ("error" in saved) throw new Error(GENERIC_CRM_ERROR);
    stampAudit("client_upsert", saved.id, "Client record saved. Clients do not receive a login.");
    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard");
    return;
  }
  mutateWorkspace((state) => {
    if (payload.id) {
      const current = state.clients.find((item) => item.id === payload.id);
      if (current) Object.assign(current, payload, { portalEnabled: false });
      return;
    }
    state.clients.unshift({
      ...payload,
      id: `client-${Date.now()}`,
      contactName: payload.contactName || "Add contact name",
    });
  });
  stampAudit("client_upsert", payload.id || "new", "Client record saved. Clients do not receive a login.");
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
  const session = await getSession();
  if (shouldUseOpsDatabase(session.user)) {
    const write = await requireOperationsWrite();
    const factory = createSupabaseServer();
    if (!factory) throw new Error(GENERIC_OPS_ERROR);
    const supabase = await factory();
    const current = input.id ? await loadOpsTask(supabase, write.organizationId, input.id) : null;
    const payload: TaskItem = {
      id: input.id || current?.id || "",
      title: input.title || current?.title || "New task",
      projectId: input.projectId ?? current?.projectId ?? null,
      clientId: input.clientId ?? current?.clientId ?? null,
      dueDate: input.dueDate ?? current?.dueDate ?? null,
      status: input.status || current?.status || "todo",
      priority: input.priority || current?.priority || "medium",
      assignee: input.assignee || current?.assignee || "Owner",
      notes: input.notes ?? current?.notes ?? "",
    };
    const saved = await saveOpsTaskInDatabase(supabase, write.organizationId, payload);
    if ("error" in saved) throw new Error(GENERIC_OPS_ERROR);
    stampAudit("task_upsert", saved.id, "Task saved.");
    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard");
    return;
  }
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

export async function archiveTask(id: string) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const session = await getSession();
  if (shouldUseOpsDatabase(session.user)) {
    const write = await requireOperationsWrite();
    const factory = createSupabaseServer();
    if (!factory) throw new Error(GENERIC_OPS_ERROR);
    const supabase = await factory();
    const saved = await archiveOpsTaskInDatabase(supabase, write.organizationId, id);
    if ("error" in saved) throw new Error(GENERIC_OPS_ERROR);
    stampAudit("task_archive", id, "Task archived.");
    revalidatePath("/dashboard/tasks");
    revalidatePath("/dashboard");
    return;
  }
  mutateWorkspace((state) => {
    state.tasks = state.tasks.filter((item) => item.id !== id);
  });
  stampAudit("task_archive", id, "Task archived.");
  revalidatePath("/dashboard/tasks");
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

export async function archiveProjectForm(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  await archiveProject(id);
}

export async function archiveTaskForm(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  await archiveTask(id);
}

export async function archiveRevenueForm(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  await archiveRevenue(id);
}

export async function saveNoteForm(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const session = await getSession();
  const id = String(formData.get("id") || "");
  const title = sanitizeText(String(formData.get("title") || "")).slice(0, 160);
  const body = sanitizeText(String(formData.get("body") || "")).slice(0, 8000);
  if (!title) return { error: "Enter a title up to 160 characters." };
  if (!body) return { error: "Enter a note up to 8,000 characters." };
  const pinField = formData.get("pinned");
  const pinned = pinField === "on" || pinField === "true" || pinField === "1";

  if (shouldUseWorkspaceDatabase(session.user) && session.user?.organizationId) {
    const factory = createSupabaseServer();
    if (!factory) return { error: GENERIC_WORKSPACE_ERROR };
    const supabase = await factory();
    const current = id ? await loadWorkspaceNote(supabase, session.user.organizationId, id) : null;
    if (current && "error" in current) return { error: GENERIC_WORKSPACE_ERROR };
    const relationship = resolveNoteRelationship(formData, current);
    if (relationship.relatedType !== "none" && !relationship.relatedId) {
      return { error: "Choose a related record in this organization." };
    }
    const saved = await saveWorkspaceNote(supabase, session.user.organizationId, {
      id: id || undefined,
      title,
      body,
      relatedType: relationship.relatedType,
      relatedId: relationship.relatedId,
      pinned,
    });
    if ("error" in saved) return { error: GENERIC_WORKSPACE_ERROR };
    stampAudit("note_upsert", saved.id, "Note saved.");
    revalidatePath("/dashboard/notes");
    revalidatePath("/dashboard");
    return { ok: true as const };
  }

  mutateWorkspace((state) => {
    const current = id ? state.notes.find((item) => item.id === id) : undefined;
    const relationship = resolveNoteRelationship(formData, current);
    const payload: OwnerNote = {
      id: id || `note-${Date.now()}`,
      title,
      body,
      relatedType: relationship.relatedType,
      relatedId: relationship.relatedId,
      pinned,
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
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function archiveNoteForm(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const id = String(formData.get("id") || "");
  if (!id) return { error: "Choose a note to archive." };
  const session = await getSession();
  if (shouldUseWorkspaceDatabase(session.user) && session.user?.organizationId) {
    const factory = createSupabaseServer();
    if (!factory) return { error: GENERIC_WORKSPACE_ERROR };
    const supabase = await factory();
    const saved = await archiveWorkspaceNote(supabase, session.user.organizationId, id);
    if ("error" in saved) return { error: GENERIC_WORKSPACE_ERROR };
    stampAudit("note_archived", saved.id, "Note archived.");
    revalidatePath("/dashboard/notes");
    revalidatePath("/dashboard");
    return { ok: true as const };
  }
  mutateWorkspace((state) => {
    state.notes = state.notes.filter((item) => item.id !== id);
  });
  stampAudit("note_archived", id, "Note archived.");
  revalidatePath("/dashboard/notes");
  revalidatePath("/dashboard");
  return { ok: true as const };
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
  const organizationId = sessionOrganizationId((await getSession()).user);
  if (!isPersistedWorkspaceId(organizationId) || !/^[A-Za-z0-9_-]{1,80}$/.test(expenseId)) {
    stampAudit("receipt_upload_failed", expenseId, "Receipt upload rejected because the object path was not organization scoped.");
    return { error: "The receipt could not be stored.", status: "storage_failed" as const };
  }
  const path = `${organizationId}/${expenseId}/${Date.now()}-${safeUploadFileName(upload.name)}`;
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
  const format = describeMfaAttempt({
    code,
    demoMode: isDemoModeEnabled(),
    backendConfigured: isSupabaseConfigured(),
    production: process.env.NODE_ENV === "production",
    verifiedByProvider: false,
  });
  if (format.status === "not_configured" || format.status === "missing" || format.status === "forged" || format.status === "expired") {
    stampAudit("mfa_rejected", "auth", "MFA challenge rejected. No code was logged.");
    return { error: format.message, status: format.status, grantOwnerSession: false as const };
  }

  const factory = createSupabaseServer();
  if (!factory) {
    stampAudit("mfa_rejected", "auth", "MFA challenge rejected. No code was logged.");
    return { error: NOT_CONFIGURED_MESSAGE, status: "not_configured" as const, grantOwnerSession: false as const };
  }
  const supabase = await factory();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    stampAudit("mfa_rejected", "auth", "MFA challenge rejected. No code was logged.");
    return { error: GENERIC_AUTH_ERROR, status: "invalid" as const, grantOwnerSession: false as const };
  }

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp.find((factor) => factor.status === "verified") ?? factors?.totp[0];
  if (!totp) {
    stampAudit("mfa_rejected", "auth", "MFA challenge rejected. No code was logged.");
    return { error: GENERIC_AUTH_ERROR, status: "invalid" as const, grantOwnerSession: false as const };
  }

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: totp.id });
  if (challengeError || !challenge) {
    stampAudit("mfa_rejected", "auth", "MFA challenge rejected. No code was logged.");
    return { error: GENERIC_AUTH_ERROR, status: "invalid" as const, grantOwnerSession: false as const };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: totp.id,
    challengeId: challenge.id,
    code,
  });
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const verifiedByProvider = !verifyError && assurance?.currentLevel === "aal2";
  const attempt = describeMfaAttempt({
    code,
    demoMode: isDemoModeEnabled(),
    backendConfigured: isSupabaseConfigured(),
    production: process.env.NODE_ENV === "production",
    verifiedByProvider,
  });
  if (!attempt.ok || !attempt.grantOwnerSession) {
    stampAudit("mfa_rejected", "auth", "MFA challenge rejected. No code was logged.");
    return { error: attempt.message, status: attempt.status, grantOwnerSession: false as const };
  }
  stampAudit("mfa_verified", "auth", "MFA challenge verified. No code was logged.");
  const next = String(formData.get("next") || "/dashboard");
  redirect(isSafePath(next) ? next : "/dashboard");
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
  if (!email) {
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
  const session = await getSession();
  const id = String(formData.get("id") || "");
  const file = formData.get("file");
  const upload = file instanceof File && file.size > 0 ? file : null;
  const name = sanitizeText(String(formData.get("name") || upload?.name || "")).slice(0, 180);
  const notes = sanitizeText(String(formData.get("notes") || "")).slice(0, 2000);
  const categoryRaw = String(formData.get("category") || "other");
  const category = DOCUMENT_CATEGORIES.includes(categoryRaw as OsDocument["category"])
    ? (categoryRaw as OsDocument["category"])
    : "other";
  const relatedType = String(formData.get("relatedType") || "none");
  const relatedId = String(formData.get("relatedId") || "") || null;
  const clientId = relatedType === "client" ? relatedId : null;
  const projectId = relatedType === "project" ? relatedId : null;

  if (shouldUseWorkspaceDatabase(session.user) && session.user?.organizationId) {
    if (!id && !upload) return { error: "Choose a PDF, PNG, JPEG, or text file up to 8MB." };
    if (upload) {
      const validationError = documentUploadError(upload);
      if (validationError) return { error: validationError };
    }
    if (!isObjectStorageConfigured()) {
      stampAudit("document_upload_blocked", id || "new", "Document upload blocked because private storage is not configured.");
      return { error: STORAGE_NOT_CONFIGURED_MESSAGE, status: "storage_not_configured" as const };
    }
    const factory = createSupabaseServer();
    if (!factory) return { error: GENERIC_WORKSPACE_ERROR };
    const supabase = await factory();
    const organizationId = session.user.organizationId;
    const current = id ? await loadWorkspaceDocument(supabase, organizationId, id) : null;
    if (current && "error" in current) return { error: GENERIC_WORKSPACE_ERROR };
    if (id && !current) return { error: GENERIC_WORKSPACE_ERROR };

    let storagePath = current?.storagePath || "";
    let contentType = current?.contentType || "";
    let byteSize = current?.byteSize || 0;
    const displayName = name || current?.name || "document";

    if (upload) {
      const bytes = new Uint8Array(await upload.arrayBuffer());
      const sniffed = sniffDocumentContentType(bytes, upload.type, upload.name);
      if (!sniffed || (upload.type && upload.type !== sniffed)) {
        return { error: "Upload a PDF, PNG, JPEG, or plain text file up to 8MB." };
      }
      const documentId = current?.id || newDocumentId();
      storagePath = generatedDocumentPath(organizationId, documentId, upload.name);
      const { error } = await supabase.storage.from(ORG_DOCUMENTS_BUCKET).upload(storagePath, bytes, {
        upsert: false,
        contentType: sniffed,
      });
      if (error) {
        stampAudit("document_upload_failed", documentId, "Document upload failed. Metadata was not saved.");
        return { error: "The file could not be stored." };
      }
      contentType = sniffed;
      byteSize = bytes.byteLength;
      const saved = await saveWorkspaceDocument(supabase, organizationId, {
        id: documentId,
        storagePath,
        displayFilename: displayName,
        contentType,
        byteSize,
        description: notes,
        category,
        clientId,
        projectId,
      });
      if ("error" in saved) return { error: GENERIC_WORKSPACE_ERROR };
      stampAudit("document_created", saved.id, "Document metadata saved. Files stay private.");
      revalidatePath("/dashboard/documents");
      revalidatePath("/dashboard");
      return { ok: true as const };
    }

    const saved = await saveWorkspaceDocument(supabase, organizationId, {
      id,
      storagePath,
      displayFilename: displayName,
      contentType,
      byteSize,
      description: notes,
      category,
      clientId,
      projectId,
    });
    if ("error" in saved) return { error: GENERIC_WORKSPACE_ERROR };
    stampAudit("document_updated", saved.id, "Document metadata saved. Files stay private.");
    revalidatePath("/dashboard/documents");
    revalidatePath("/dashboard");
    return { ok: true as const };
  }

  if (upload) {
    const validationError = documentUploadError(upload);
    if (validationError) return { error: validationError };
  }
  mutateWorkspace((state) => {
    const item: OsDocument = {
      id: id || `doc-${Date.now()}`,
      name: name || "Untitled document",
      category,
      relatedType: relatedType === "client" || relatedType === "project" ? relatedType : "none",
      relatedId: relatedType === "client" || relatedType === "project" ? relatedId : null,
      notes,
      storagePath: upload ? upload.name : null,
      contentType: upload?.type,
      byteSize: upload?.size,
      createdAt: new Date().toISOString(),
    };
    if (id) {
      const current = state.osDocuments.find((row) => row.id === id);
      if (current) Object.assign(current, item, { createdAt: current.createdAt, storagePath: item.storagePath ?? current.storagePath });
    } else {
      state.osDocuments.unshift(item);
    }
    if (upload) {
      state.files.unshift({
        id: `f-${Date.now()}`,
        name: upload.name,
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
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function archiveDocumentForm(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const id = String(formData.get("id") || "");
  if (!id) return { error: "Choose a document to archive." };
  const session = await getSession();
  if (shouldUseWorkspaceDatabase(session.user) && session.user?.organizationId) {
    const factory = createSupabaseServer();
    if (!factory) return { error: GENERIC_WORKSPACE_ERROR };
    const supabase = await factory();
    const saved = await archiveWorkspaceDocument(supabase, session.user.organizationId, id);
    if ("error" in saved) return { error: GENERIC_WORKSPACE_ERROR };
    stampAudit("document_archived", saved.id, "Document metadata archived. The private object was not deleted.");
    revalidatePath("/dashboard/documents");
    revalidatePath("/dashboard");
    return { ok: true as const };
  }
  mutateWorkspace((state) => {
    state.osDocuments = state.osDocuments.filter((item) => item.id !== id);
  });
  stampAudit("document_archived", id, "Document metadata archived.");
  revalidatePath("/dashboard/documents");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function archiveDocumentPageForm(formData: FormData): Promise<void> {
  await archiveDocumentForm(formData);
}

export async function saveCalendarForm(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const session = await getSession();
  const id = String(formData.get("id") || "");
  const title = sanitizeText(String(formData.get("title") || "")).slice(0, 160);
  const description = sanitizeText(String(formData.get("description") || "")).slice(0, 4000);
  const location = sanitizeText(String(formData.get("location") || "")).slice(0, 240);
  const allDay = formData.get("allDay") === "on";
  const timezoneRaw = String(formData.get("timezone") || "America/New_York");
  const timezone = EVENT_TIMEZONES.includes(timezoneRaw as (typeof EVENT_TIMEZONES)[number])
    ? timezoneRaw
    : "";
  const kindRaw = String(formData.get("kind") || "team_meeting");
  const kind = EVENT_KINDS.includes(kindRaw as EventKind) ? (kindRaw as EventKind) : "team_meeting";
  const clientId = String(formData.get("clientId") || "") || null;
  const projectId = String(formData.get("projectId") || "") || null;
  if (title.length < 2) return { error: "Enter a title of at least 2 characters." };
  if (!timezone) return { error: "Choose a supported timezone." };
  const bounds = parseCalendarBounds({
    start: String(formData.get("start") || ""),
    end: String(formData.get("end") || ""),
    allDay,
    timezone,
  });
  if ("error" in bounds) return { error: bounds.error };

  if (shouldUseWorkspaceDatabase(session.user) && session.user?.organizationId) {
    const factory = createSupabaseServer();
    if (!factory) return { error: GENERIC_WORKSPACE_ERROR };
    const supabase = await factory();
    const current = id ? await loadWorkspaceEvent(supabase, session.user.organizationId, id) : null;
    if (current && "error" in current) return { error: GENERIC_WORKSPACE_ERROR };
    if (current && current.generated) return { error: "System-generated events cannot be edited as manual events." };
    const saved = await saveWorkspaceEvent(supabase, session.user.organizationId, {
      id: id || undefined,
      title,
      description,
      startAt: bounds.startAt,
      endAt: bounds.endAt,
      allDay,
      timezone,
      clientId,
      projectId,
      location,
      kind,
    });
    if ("error" in saved) return { error: GENERIC_WORKSPACE_ERROR };
    stampAudit("calendar_upsert", saved.id, "Internal calendar event saved. No email or external sync was sent.");
    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard");
    return { ok: true as const };
  }

  if (id.startsWith("generated:")) {
    return { error: "System-generated events cannot be edited as manual events." };
  }
  if (getWorkspace().events.find((item) => item.id === id)?.generated) {
    return { error: "System-generated events cannot be edited as manual events." };
  }
  mutateWorkspace((state) => {
    const payload: CalendarEvent = {
      id: id || `evt-${Date.now()}`,
      title,
      kind,
      start: bounds.startAt,
      end: bounds.endAt,
      notes: description,
      relatedId: projectId || clientId,
      location,
      allDay,
      timezone,
      clientId,
      projectId,
      generated: false,
      sourceType: "manual",
      sourceId: null,
    };
    if (id) {
      const current = state.events.find((item) => item.id === id);
      if (current?.generated) return;
      if (current) Object.assign(current, payload);
    } else {
      state.events.unshift(payload);
    }
  });
  stampAudit("calendar_upsert", id || "new", "Internal calendar event saved. No email or external sync was sent.");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function archiveCalendarForm(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const id = String(formData.get("id") || "");
  if (!id) return { error: "Choose an event to archive." };
  const session = await getSession();
  if (shouldUseWorkspaceDatabase(session.user) && session.user?.organizationId) {
    const factory = createSupabaseServer();
    if (!factory) return { error: GENERIC_WORKSPACE_ERROR };
    const supabase = await factory();
    const current = await loadWorkspaceEvent(supabase, session.user.organizationId, id);
    if (current && "error" in current) return { error: GENERIC_WORKSPACE_ERROR };
    if (current?.generated) return { error: "System-generated events cannot be archived as unrelated manual events." };
    const saved = await archiveWorkspaceEvent(supabase, session.user.organizationId, id);
    if ("error" in saved) return { error: GENERIC_WORKSPACE_ERROR };
    stampAudit("calendar_archived", saved.id, "Calendar event archived.");
    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard");
    return { ok: true as const };
  }
  if (id.startsWith("generated:") || getWorkspace().events.find((item) => item.id === id)?.generated) {
    return { error: "System-generated events cannot be archived as unrelated manual events." };
  }
  mutateWorkspace((state) => {
    state.events = state.events.filter((item) => item.id !== id);
  });
  stampAudit("calendar_archived", id, "Calendar event archived.");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

function invoiceFormPayload(formData: FormData) {
  const lines = parseInvoiceLinesFromForm(formData);
  const lineError = validateInvoiceLines(lines);
  if (lineError) return { error: lineError };
  const discountCents = parseDollarsToCents(String(formData.get("discount") || "0"));
  const taxCents = parseDollarsToCents(String(formData.get("tax") || "0"));
  const totals = computeInvoiceTotals(lines, discountCents, taxCents);
  if (totals.discountCents > totals.subtotalCents) return { error: "Discount cannot exceed the subtotal." };
  if (totals.totalCents < 0) return { error: "Invoice total cannot be negative." };
  return {
    clientId: String(formData.get("clientId") || "") || null,
    issueDate: String(formData.get("issueDate") || "") || null,
    dueDate: String(formData.get("dueDate") || "") || null,
    currency: String(formData.get("currency") || "USD").toUpperCase().slice(0, 3),
    notes: sanitizeText(String(formData.get("notes") || "")).slice(0, 4000),
    paymentInstructions: sanitizeText(String(formData.get("paymentInstructions") || "")).slice(0, 2000),
    discountCents: totals.discountCents,
    taxCents: totals.taxCents,
    lines,
    totals,
  };
}

export async function saveInvoiceForm(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const payload = invoiceFormPayload(formData);
  if ("error" in payload) return payload;
  const id = String(formData.get("id") || "");
  const session = await getSession();
  if (shouldUseWorkspaceDatabase(session.user) && session.user?.organizationId) {
    await requireInvoiceWrite();
    const factory = createSupabaseServer();
    if (!factory) return { error: GENERIC_WORKSPACE_ERROR };
    const supabase = await factory();
    const saved = await saveWorkspaceInvoice(supabase, session.user.organizationId, {
      id: id || undefined,
      clientId: payload.clientId,
      issueDate: payload.issueDate,
      dueDate: payload.dueDate,
      currency: payload.currency,
      notes: payload.notes,
      paymentInstructions: payload.paymentInstructions,
      discountCents: payload.discountCents,
      taxCents: payload.taxCents,
      lines: payload.lines,
    });
    if ("error" in saved) return { error: GENERIC_WORKSPACE_ERROR };
    stampAudit("invoice_upsert", saved.id, "Invoice draft saved. Totals were calculated on the server.");
    revalidatePath("/dashboard/invoices");
    revalidatePath("/dashboard");
    return { ok: true as const };
  }
  mutateWorkspace((state) => {
    const now = new Date().toISOString();
    const current = id ? state.workspaceInvoices.find((item) => item.id === id) : undefined;
    if (current && current.status !== "draft") return;
    const next = {
      id: current?.id || `winv-${Date.now()}`,
      invoiceNumber: current?.invoiceNumber || `DRAFT-${Date.now()}`,
      status: "draft" as const,
      clientId: payload.clientId,
      issueDate: payload.issueDate,
      dueDate: payload.dueDate,
      currency: payload.currency || "USD",
      notes: payload.notes,
      paymentInstructions: payload.paymentInstructions,
      orgLegalName: "",
      orgDisplayName: "",
      clientBusinessName: "",
      clientContactName: "",
      clientEmail: "",
      subtotalCents: payload.totals.subtotalCents,
      discountCents: payload.totals.discountCents,
      taxCents: payload.totals.taxCents,
      totalCents: payload.totals.totalCents,
      amountPaidCents: 0,
      lines: payload.lines.map((line, index) => ({
        position: index + 1,
        description: line.description,
        quantity: line.quantity,
        unitCents: line.unitCents,
        lineTotalCents: line.quantity * line.unitCents,
      })),
      sourceEstimateId: current?.sourceEstimateId ?? null,
      sourceEstimateNumber: current?.sourceEstimateNumber ?? "",
      issuedAt: null,
      paidAt: null,
      voidedAt: null,
      archived: false,
      createdAt: current?.createdAt || now,
      updatedAt: now,
    };
    if (current) Object.assign(current, next);
    else state.workspaceInvoices.unshift(next);
  });
  stampAudit("invoice_upsert", id || "new", "Invoice draft saved. Totals were calculated on the server.");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function issueInvoiceForm(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const id = String(formData.get("id") || "");
  if (!id) return { error: "Choose an invoice to issue." };
  const session = await getSession();
  if (shouldUseWorkspaceDatabase(session.user) && session.user?.organizationId) {
    await requireInvoiceWrite();
    const factory = createSupabaseServer();
    if (!factory) return { error: GENERIC_WORKSPACE_ERROR };
    const supabase = await factory();
    const saved = await issueWorkspaceInvoice(supabase, session.user.organizationId, id);
    if ("error" in saved) return { error: GENERIC_WORKSPACE_ERROR };
    stampAudit("invoice_issued", saved.id, "Invoice marked issued in the system. No email was sent.");
    revalidatePath("/dashboard/invoices");
    revalidatePath("/dashboard");
    return { ok: true as const };
  }
  mutateWorkspace((state) => {
    const invoice = state.workspaceInvoices.find((item) => item.id === id);
    if (!invoice || invoice.status !== "draft" || invoice.archived) return;
    const client = state.clients.find((item) => item.id === invoice.clientId);
    const issuedCount = state.workspaceInvoices.filter((item) => item.status !== "draft").length + 1;
    invoice.status = "issued";
    invoice.invoiceNumber = `STS-${String(issuedCount).padStart(4, "0")}`;
    invoice.issueDate = invoice.issueDate || new Date().toISOString().slice(0, 10);
    invoice.dueDate = invoice.dueDate || invoice.issueDate;
    invoice.issuedAt = new Date().toISOString();
    invoice.orgLegalName = state.brand.legalName;
    invoice.orgDisplayName = state.brand.shortName;
    invoice.clientBusinessName = client?.businessName || "";
    invoice.clientContactName = client?.contactName || "";
    invoice.clientEmail = client?.email || "";
    invoice.updatedAt = new Date().toISOString();
  });
  stampAudit("invoice_issued", id, "Invoice marked issued in the system. No email was sent.");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function recordInvoicePaymentForm(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const id = String(formData.get("id") || "");
  if (!id) return { error: "Choose an invoice." };
  const session = await getSession();
  if (shouldUseWorkspaceDatabase(session.user) && session.user?.organizationId) {
    await requireInvoiceWrite();
    const factory = createSupabaseServer();
    if (!factory) return { error: GENERIC_WORKSPACE_ERROR };
    const supabase = await factory();
    const saved = await recordWorkspaceInvoicePayment(supabase, session.user.organizationId, id);
    if ("error" in saved) return { error: GENERIC_WORKSPACE_ERROR };
    stampAudit("invoice_payment_recorded", saved.id, "Payment recorded manually. No processor is connected.");
    revalidatePath("/dashboard/invoices");
    revalidatePath("/dashboard");
    return { ok: true as const };
  }
  mutateWorkspace((state) => {
    const invoice = state.workspaceInvoices.find((item) => item.id === id);
    if (!invoice || invoice.status !== "issued" || invoice.archived) return;
    invoice.status = "paid";
    invoice.paidAt = new Date().toISOString();
    invoice.amountPaidCents = invoice.totalCents;
    invoice.updatedAt = new Date().toISOString();
  });
  stampAudit("invoice_payment_recorded", id, "Payment recorded manually. No processor is connected.");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function voidInvoiceForm(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const id = String(formData.get("id") || "");
  if (!id) return { error: "Choose an invoice to void." };
  const session = await getSession();
  if (shouldUseWorkspaceDatabase(session.user) && session.user?.organizationId) {
    await requireInvoiceWrite();
    const factory = createSupabaseServer();
    if (!factory) return { error: GENERIC_WORKSPACE_ERROR };
    const supabase = await factory();
    const saved = await voidWorkspaceInvoice(supabase, session.user.organizationId, id);
    if ("error" in saved) return { error: GENERIC_WORKSPACE_ERROR };
    stampAudit("invoice_voided", saved.id, "Invoice voided. This is not a tax or legal filing.");
    revalidatePath("/dashboard/invoices");
    revalidatePath("/dashboard");
    return { ok: true as const };
  }
  mutateWorkspace((state) => {
    const invoice = state.workspaceInvoices.find((item) => item.id === id);
    if (!invoice || invoice.archived || invoice.status === "paid") return;
    invoice.status = "void";
    invoice.voidedAt = new Date().toISOString();
    invoice.amountPaidCents = 0;
    invoice.updatedAt = new Date().toISOString();
  });
  stampAudit("invoice_voided", id, "Invoice voided. This is not a tax or legal filing.");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function archiveInvoiceForm(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const id = String(formData.get("id") || "");
  if (!id) return { error: "Choose an invoice to archive." };
  const session = await getSession();
  if (shouldUseWorkspaceDatabase(session.user) && session.user?.organizationId) {
    await requireInvoiceWrite();
    const factory = createSupabaseServer();
    if (!factory) return { error: GENERIC_WORKSPACE_ERROR };
    const supabase = await factory();
    const saved = await archiveWorkspaceInvoice(supabase, session.user.organizationId, id);
    if ("error" in saved) return { error: GENERIC_WORKSPACE_ERROR };
    stampAudit("invoice_archived", saved.id, "Invoice archived.");
    revalidatePath("/dashboard/invoices");
    revalidatePath("/dashboard");
    return { ok: true as const };
  }
  mutateWorkspace((state) => {
    const invoice = state.workspaceInvoices.find((item) => item.id === id);
    if (invoice) invoice.archived = true;
  });
  stampAudit("invoice_archived", id, "Invoice archived.");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

function estimateFormPayload(formData: FormData) {
  const lines = parseEstimateLinesFromForm(formData);
  const lineError = validateEstimateLines(lines);
  if (lineError) return { error: lineError };
  const taxCents = parseDollarsToCents(String(formData.get("tax") || "0"));
  const totals = computeEstimateTotals(lines, taxCents);
  if (totals.discountCents > totals.subtotalCents) return { error: "Discount cannot exceed the subtotal." };
  if (totals.totalCents < 0) return { error: "Estimate total cannot be negative." };
  const title = sanitizeText(String(formData.get("title") || "")).slice(0, 160);
  if (title.length < 2) return { error: "Add a title for this estimate." };
  const issueDate = String(formData.get("issueDate") || "") || null;
  const expiresOn = String(formData.get("expiresOn") || "") || null;
  if (issueDate && expiresOn && expiresOn < issueDate) return { error: "The expiration date cannot be before the issue date." };
  return {
    clientId: String(formData.get("clientId") || "") || null,
    title,
    description: sanitizeText(String(formData.get("description") || "")).slice(0, 4000),
    issueDate,
    expiresOn,
    currency: String(formData.get("currency") || "USD").toUpperCase().slice(0, 3),
    internalNotes: sanitizeText(String(formData.get("internalNotes") || "")).slice(0, 4000),
    customerNotes: sanitizeText(String(formData.get("customerNotes") || "")).slice(0, 4000),
    terms: sanitizeText(String(formData.get("terms") || "")).slice(0, 4000),
    clientBusinessName: sanitizeText(String(formData.get("clientBusinessName") || "")).slice(0, 160),
    clientContactName: sanitizeText(String(formData.get("clientContactName") || "")).slice(0, 160),
    clientEmail: sanitizeText(String(formData.get("clientEmail") || "")).slice(0, 254),
    taxCents: totals.taxCents,
    lines,
    totals,
  };
}

export async function saveEstimateForm(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const payload = estimateFormPayload(formData);
  if ("error" in payload) return payload;
  const id = String(formData.get("id") || "");
  const session = await getSession();
  if (shouldUseEstimateDatabase(session.user) && session.user?.organizationId) {
    await requireEstimateWrite();
    const factory = createSupabaseServer();
    if (!factory) return { error: GENERIC_ESTIMATE_ERROR };
    const supabase = await factory();
    const saved = await saveWorkspaceEstimate(supabase, session.user.organizationId, {
      id: id || undefined,
      clientId: payload.clientId,
      title: payload.title,
      description: payload.description,
      issueDate: payload.issueDate,
      expiresOn: payload.expiresOn,
      currency: payload.currency,
      internalNotes: payload.internalNotes,
      customerNotes: payload.customerNotes,
      terms: payload.terms,
      clientBusinessName: payload.clientBusinessName,
      clientContactName: payload.clientContactName,
      clientEmail: payload.clientEmail,
      taxCents: payload.taxCents,
      lines: payload.lines,
    });
    if ("error" in saved) return { error: GENERIC_ESTIMATE_ERROR };
    stampAudit("estimate_upsert", saved.id, "Estimate draft saved. Totals were calculated on the server.");
    revalidatePath("/dashboard/estimates");
    revalidatePath("/dashboard");
    return { ok: true as const };
  }
  mutateWorkspace((state) => {
    const now = new Date().toISOString();
    const current = id ? state.workspaceEstimates.find((item) => item.id === id) : undefined;
    if (current && (current.status !== "draft" || current.archived)) return;
    const next: WorkspaceEstimate = {
      id: current?.id || `est-${Date.now()}`,
      estimateNumber: current?.estimateNumber || `EST-${String(state.workspaceEstimates.length + 1).padStart(4, "0")}`,
      status: "draft",
      title: payload.title,
      description: payload.description,
      clientId: payload.clientId,
      issueDate: payload.issueDate,
      expiresOn: payload.expiresOn,
      currency: payload.currency || "USD",
      internalNotes: payload.internalNotes,
      customerNotes: payload.customerNotes,
      terms: payload.terms,
      orgLegalName: "",
      orgDisplayName: "",
      clientBusinessName: payload.clientBusinessName,
      clientContactName: payload.clientContactName,
      clientEmail: payload.clientEmail,
      subtotalCents: payload.totals.subtotalCents,
      discountCents: payload.totals.discountCents,
      taxCents: payload.totals.taxCents,
      totalCents: payload.totals.totalCents,
      lines: payload.lines.map((line, index) => ({
        position: index + 1,
        description: line.description,
        quantity: line.quantity,
        unitCents: line.unitCents,
        discountCents: line.discountCents,
        lineTotalCents: line.quantity * line.unitCents - line.discountCents,
      })),
      readyAt: null,
      acceptedAt: null,
      declinedAt: null,
      expiredAt: null,
      archived: false,
      createdAt: current?.createdAt || now,
      updatedAt: now,
    };
    if (current) Object.assign(current, next);
    else state.workspaceEstimates.unshift(next);
  });
  stampAudit("estimate_upsert", id || "new", "Estimate draft saved. Totals were calculated on the server.");
  revalidatePath("/dashboard/estimates");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function setEstimateStatusForm(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "") as WorkspaceEstimateStatus;
  if (!id) return { error: "Choose an estimate." };
  if (!["draft", "ready", "accepted", "declined", "expired"].includes(status)) {
    return { error: "That status change is not allowed." };
  }
  const session = await getSession();
  if (shouldUseEstimateDatabase(session.user) && session.user?.organizationId) {
    await requireEstimateWrite();
    const factory = createSupabaseServer();
    if (!factory) return { error: GENERIC_ESTIMATE_ERROR };
    const supabase = await factory();
    const saved = await setWorkspaceEstimateStatus(supabase, session.user.organizationId, id, status);
    if ("error" in saved) return { error: GENERIC_ESTIMATE_ERROR };
    stampAudit("estimate_status_changed", saved.id, `Estimate marked ${status}. No email or PDF was created.`);
    revalidatePath("/dashboard/estimates");
    revalidatePath("/dashboard");
    return { ok: true as const };
  }
  let denied = false;
  mutateWorkspace((state) => {
    const estimate = state.workspaceEstimates.find((item) => item.id === id);
    if (!estimate || estimate.archived) {
      denied = true;
      return;
    }
    if (!canTransitionEstimateStatus(estimate.status, status)) {
      denied = true;
      return;
    }
    const now = new Date().toISOString();
    if (status === "ready") {
      estimate.status = "ready";
      estimate.readyAt = now;
      estimate.acceptedAt = null;
      estimate.declinedAt = null;
      estimate.expiredAt = null;
      estimate.issueDate = estimate.issueDate || now.slice(0, 10);
      estimate.orgLegalName = state.brand.legalName;
      estimate.orgDisplayName = state.brand.shortName;
    } else if (status === "draft") {
      estimate.status = "draft";
      estimate.readyAt = null;
      estimate.acceptedAt = null;
      estimate.declinedAt = null;
      estimate.expiredAt = null;
    } else if (status === "accepted") {
      estimate.status = "accepted";
      estimate.acceptedAt = now;
      estimate.declinedAt = null;
      estimate.expiredAt = null;
    } else if (status === "declined") {
      estimate.status = "declined";
      estimate.declinedAt = now;
      estimate.acceptedAt = null;
      estimate.expiredAt = null;
    } else {
      estimate.status = "expired";
      estimate.expiredAt = now;
      estimate.acceptedAt = null;
      estimate.declinedAt = null;
    }
    estimate.updatedAt = now;
  });
  if (denied) return { error: GENERIC_ESTIMATE_ERROR };
  stampAudit("estimate_status_changed", id, `Estimate marked ${status}. No email or PDF was created.`);
  revalidatePath("/dashboard/estimates");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function archiveEstimateForm(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const id = String(formData.get("id") || "");
  if (!id) return { error: "Choose an estimate to archive." };
  const session = await getSession();
  if (shouldUseEstimateDatabase(session.user) && session.user?.organizationId) {
    await requireEstimateWrite();
    const factory = createSupabaseServer();
    if (!factory) return { error: GENERIC_ESTIMATE_ERROR };
    const supabase = await factory();
    const saved = await archiveWorkspaceEstimate(supabase, session.user.organizationId, id);
    if ("error" in saved) return { error: GENERIC_ESTIMATE_ERROR };
    stampAudit("estimate_archived", saved.id, "Estimate archived.");
    revalidatePath("/dashboard/estimates");
    revalidatePath("/dashboard");
    return { ok: true as const };
  }
  mutateWorkspace((state) => {
    const estimate = state.workspaceEstimates.find((item) => item.id === id);
    if (estimate) estimate.archived = true;
  });
  stampAudit("estimate_archived", id, "Estimate archived.");
  revalidatePath("/dashboard/estimates");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function restoreEstimateForm(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const id = String(formData.get("id") || "");
  if (!id) return { error: "Choose an estimate to restore." };
  const session = await getSession();
  if (shouldUseEstimateDatabase(session.user) && session.user?.organizationId) {
    await requireEstimateWrite();
    const factory = createSupabaseServer();
    if (!factory) return { error: GENERIC_ESTIMATE_ERROR };
    const supabase = await factory();
    const saved = await restoreWorkspaceEstimate(supabase, session.user.organizationId, id);
    if ("error" in saved) return { error: GENERIC_ESTIMATE_ERROR };
    stampAudit("estimate_restored", saved.id, "Estimate restored.");
    revalidatePath("/dashboard/estimates");
    revalidatePath("/dashboard");
    return { ok: true as const };
  }
  mutateWorkspace((state) => {
    const estimate = state.workspaceEstimates.find((item) => item.id === id);
    if (estimate) estimate.archived = false;
  });
  stampAudit("estimate_restored", id, "Estimate restored.");
  revalidatePath("/dashboard/estimates");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function convertEstimateToInvoiceForm(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const id = String(formData.get("id") || "");
  if (!id) return { error: "Choose an estimate to convert." };
  const session = await getSession();
  if (
    shouldUseEstimateDatabase(session.user) &&
    shouldUseWorkspaceDatabase(session.user) &&
    session.user?.organizationId
  ) {
    await requireInvoiceWrite();
    const factory = createSupabaseServer();
    if (!factory) return { error: GENERIC_CONVERT_ERROR };
    const supabase = await factory();
    const saved = await convertEstimateToInvoice(supabase, session.user.organizationId, id);
    if ("error" in saved) return { error: GENERIC_CONVERT_ERROR };
    stampAudit("estimate_converted_to_invoice", saved.id, "Draft invoice created from an accepted estimate. Nothing was emailed or charged.");
    revalidatePath("/dashboard/estimates");
    revalidatePath("/dashboard/invoices");
    revalidatePath("/dashboard");
    return { ok: true as const, invoiceId: saved.id };
  }
  let invoiceId = "";
  let denied = false;
  mutateWorkspace((state) => {
    const existing = state.workspaceInvoices.find((item) => item.sourceEstimateId === id);
    if (existing) {
      invoiceId = existing.id;
      return;
    }
    const estimate = state.workspaceEstimates.find((item) => item.id === id);
    if (!estimate || !canConvertEstimateToInvoice(estimate)) {
      denied = true;
      return;
    }
    const next = draftInvoiceFromAcceptedEstimate(estimate, `winv-${Date.now()}`);
    if (!next) {
      denied = true;
      return;
    }
    invoiceId = next.id;
    state.workspaceInvoices.unshift(next);
  });
  if (denied || !invoiceId) return { error: GENERIC_CONVERT_ERROR };
  stampAudit("estimate_converted_to_invoice", invoiceId, "Draft invoice created from an accepted estimate. Nothing was emailed or charged.");
  revalidatePath("/dashboard/estimates");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard");
  return { ok: true as const, invoiceId };
}

export async function reconcileScheduleForm(formData: FormData) {
  void formData;
  await assertSameOrigin();
  await requireOwnerWrite();
  const session = await getSession();
  if (shouldUseWorkspaceDatabase(session.user) && session.user?.organizationId) {
    const factory = createSupabaseServer();
    if (!factory) return;
    const supabase = await factory();
    const saved = await reconcileWorkspaceSchedule(supabase, session.user.organizationId);
    if ("error" in saved) return;
    stampAudit("schedule_reconciled", session.user.organizationId, "Internal schedule reconciled. No external calendar was contacted.");
    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard");
    redirect("/dashboard/calendar");
  }
  stampAudit("schedule_reconciled", "demo", "Internal schedule derived in memory. No external calendar was contacted.");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");
  redirect("/dashboard/calendar");
}

export async function startProjectFromInvoiceForm(formData: FormData) {
  await assertSameOrigin();
  await requireOwnerWrite();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const session = await getSession();
  if (shouldUseWorkspaceDatabase(session.user) && session.user?.organizationId) {
    await requireInvoiceWrite();
    await requireOperationsWrite();
    const factory = createSupabaseServer();
    if (!factory) return;
    const supabase = await factory();
    const saved = await startProjectFromInvoice(supabase, session.user.organizationId, id);
    if ("error" in saved) return;
    stampAudit("project_started_from_invoice", saved.id, "Project started from a converted invoice. The invoice was not issued, sent, or marked paid.");
    revalidatePath("/dashboard/invoices");
    revalidatePath("/dashboard/projects");
    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard");
    redirect(`/dashboard/projects/${saved.id}`);
  }
  let projectId = "";
  let denied = false;
  mutateWorkspace((state) => {
    const existing = state.projects.find((item) => item.sourceInvoiceId === id);
    if (existing) {
      projectId = existing.id;
      return;
    }
    const invoice = state.workspaceInvoices.find((item) => item.id === id);
    const estimate = invoice?.sourceEstimateId
      ? state.workspaceEstimates.find((item) => item.id === invoice.sourceEstimateId)
      : null;
    if (!invoice || !canStartProjectFromInvoice(invoice, estimate, null)) {
      denied = true;
      return;
    }
    const next = draftProjectFromConvertedInvoice(invoice, estimate!);
    projectId = next.id;
    state.projects.unshift(next);
  });
  if (denied || !projectId) return;
  stampAudit("project_started_from_invoice", projectId, "Project started from a converted invoice. The invoice was not issued, sent, or marked paid.");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard");
  redirect(`/dashboard/projects/${projectId}`);
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

const GENERIC_PORTAL_ERROR = "The client portal record could not be updated.";

function revalidateClientPortalSurfaces() {
  revalidatePath("/dashboard/client-portal");
  revalidatePath("/dashboard/estimates");
  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard/documents");
  revalidatePath("/client");
}

export async function publishClientPortalRecordForm(formData: FormData) {
  await assertSameOrigin();
  const session = await requireOwnerWrite();
  const sourceType = String(formData.get("sourceType") || "");
  const sourceId = String(formData.get("sourceId") || "");
  const confirmed = String(formData.get("confirmClient") || "") === "1";
  if (!isClientPortalSourceType(sourceType) || !isPersistedWorkspaceId(sourceId) || !confirmed) {
    return { error: GENERIC_PORTAL_ERROR };
  }
  if (!shouldUseWorkspaceDatabase(session.user)) {
    return { error: GENERIC_PORTAL_ERROR };
  }
  const factory = createSupabaseServer();
  if (!factory) return { error: GENERIC_PORTAL_ERROR };
  const supabase = await factory();
  const result = await publishClientPortalRecord(supabase, sourceType, sourceId);
  if ("error" in result) return { error: GENERIC_PORTAL_ERROR };
  revalidateClientPortalSurfaces();
  return { ok: true };
}

export async function unpublishClientPortalRecordForm(formData: FormData) {
  await assertSameOrigin();
  const session = await requireOwnerWrite();
  const sourceType = String(formData.get("sourceType") || "");
  const sourceId = String(formData.get("sourceId") || "");
  if (!isClientPortalSourceType(sourceType) || !isPersistedWorkspaceId(sourceId)) {
    return { error: GENERIC_PORTAL_ERROR };
  }
  if (!shouldUseWorkspaceDatabase(session.user)) {
    return { error: GENERIC_PORTAL_ERROR };
  }
  const factory = createSupabaseServer();
  if (!factory) return { error: GENERIC_PORTAL_ERROR };
  const supabase = await factory();
  const result = await unpublishClientPortalRecord(supabase, sourceType, sourceId);
  if ("error" in result) return { error: GENERIC_PORTAL_ERROR };
  revalidateClientPortalSurfaces();
  return { ok: true };
}

export async function linkClientPortalIdentityForm(formData: FormData) {
  await assertSameOrigin();
  const session = await requireOwnerWrite();
  const userId = String(formData.get("userId") || "");
  const crmClientId = String(formData.get("crmClientId") || "");
  if (!isPersistedWorkspaceId(userId) || !isPersistedWorkspaceId(crmClientId)) {
    return { error: GENERIC_PORTAL_ERROR };
  }
  if (!shouldUseWorkspaceDatabase(session.user)) {
    return { error: GENERIC_PORTAL_ERROR };
  }
  const factory = createSupabaseServer();
  if (!factory) return { error: GENERIC_PORTAL_ERROR };
  const supabase = await factory();
  const result = await linkClientPortalIdentity(supabase, userId, crmClientId);
  if ("error" in result) return { error: GENERIC_PORTAL_ERROR };
  revalidateClientPortalSurfaces();
  return { ok: true };
}

export async function disableClientPortalIdentityForm(formData: FormData) {
  await assertSameOrigin();
  const session = await requireOwnerWrite();
  const identityId = String(formData.get("identityId") || "");
  if (!isPersistedWorkspaceId(identityId)) {
    return { error: GENERIC_PORTAL_ERROR };
  }
  if (!shouldUseWorkspaceDatabase(session.user)) {
    return { error: GENERIC_PORTAL_ERROR };
  }
  const factory = createSupabaseServer();
  if (!factory) return { error: GENERIC_PORTAL_ERROR };
  const supabase = await factory();
  const result = await disableClientPortalIdentity(supabase, identityId);
  if ("error" in result) return { error: GENERIC_PORTAL_ERROR };
  revalidateClientPortalSurfaces();
  return { ok: true };
}


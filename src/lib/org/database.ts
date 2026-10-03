import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeAuditMetadata } from "@/lib/org/audit";
import type { BusinessSettings, BusinessSettingsInput, Organization, OrganizationAuditEvent } from "@/lib/org/types";
import type { AuditResult } from "@/lib/auth/organization-roles";

export const SETTINGS_SAVE_RPC = "sts_save_business_settings";

type OrgRow = {
  id: string;
  legal_name: string;
  display_name: string;
  slug: string;
  base_currency: string;
  timezone: string;
  fiscal_year_start: number;
  created_at: string;
  updated_at: string;
};

type SettingsRow = {
  id: string;
  organization_id: string;
  invoice_prefix: string;
  estimate_prefix: string;
  default_payment_terms: string;
  brand_settings: Record<string, unknown> | null;
  notification_settings: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type AuditRow = {
  id: string;
  organization_id: string;
  actor_user_id: string | null;
  action: string;
  result: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export function mapOrganizationRow(row: OrgRow): Organization {
  return {
    id: row.id,
    legalName: row.legal_name,
    displayName: row.display_name,
    slug: row.slug,
    baseCurrency: row.base_currency,
    timezone: row.timezone,
    fiscalYearStart: row.fiscal_year_start,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSettingsRow(row: SettingsRow): BusinessSettings {
  const brand = row.brand_settings ?? {};
  const notifications = row.notification_settings ?? {};
  return {
    id: row.id,
    organizationId: row.organization_id,
    invoicePrefix: row.invoice_prefix,
    estimatePrefix: row.estimate_prefix,
    defaultPaymentTerms: row.default_payment_terms,
    brandSettings: {
      paletteId: String(brand.paletteId ?? brand.palette_id ?? "sts-day"),
      accentColor: String(brand.accentColor ?? brand.accent_color ?? ""),
      logoText: String(brand.logoText ?? brand.logo_text ?? "STS"),
    },
    notificationSettings: {
      emailInvoices: Boolean(notifications.emailInvoices ?? notifications.email_invoices),
      emailEstimates: Boolean(notifications.emailEstimates ?? notifications.email_estimates),
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapAuditRow(row: AuditRow): OrganizationAuditEvent {
  const result = row.result === "failure" || row.result === "denied" ? row.result : "success";
  return {
    id: row.id,
    organizationId: row.organization_id,
    actorUserId: row.actor_user_id,
    action: row.action,
    result: result as AuditResult,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: sanitizeAuditMetadata(row.metadata ?? {}),
    createdAt: row.created_at,
  };
}

export async function loadOrganizationBundleFromDatabase(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{
  organization: Organization | null;
  settings: BusinessSettings | null;
  audit: OrganizationAuditEvent[];
} | { error: true }> {
  try {
    const [orgResult, settingsResult, auditResult] = await Promise.all([
      supabase.from("organizations").select("id, legal_name, display_name, slug, base_currency, timezone, fiscal_year_start, created_at, updated_at").eq("id", organizationId).maybeSingle(),
      supabase.from("business_settings").select("id, organization_id, invoice_prefix, estimate_prefix, default_payment_terms, brand_settings, notification_settings, created_at, updated_at").eq("organization_id", organizationId).maybeSingle(),
      supabase.from("audit_events").select("id, organization_id, actor_user_id, action, result, entity_type, entity_id, metadata, created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(8),
    ]);
    if (orgResult.error || settingsResult.error) return { error: true };
    return {
      organization: orgResult.data ? mapOrganizationRow(orgResult.data as OrgRow) : null,
      settings: settingsResult.data ? mapSettingsRow(settingsResult.data as SettingsRow) : null,
      audit: ((auditResult.data ?? []) as AuditRow[]).map(mapAuditRow),
    };
  } catch {
    return { error: true };
  }
}

export async function saveOrganizationSettingsInDatabase(
  supabase: SupabaseClient,
  organizationId: string,
  values: BusinessSettingsInput,
): Promise<{ auditId: string } | { error: true }> {
  try {
    const { data, error } = await supabase.rpc(SETTINGS_SAVE_RPC, {
      p_organization_id: organizationId,
      p_legal_name: values.legalName,
      p_display_name: values.displayName,
      p_timezone: values.timezone,
      p_base_currency: values.baseCurrency,
      p_fiscal_year_start: values.fiscalYearStart,
      p_invoice_prefix: values.invoicePrefix,
      p_estimate_prefix: values.estimatePrefix,
      p_default_payment_terms: values.defaultPaymentTerms,
    });
    if (error || !data) return { error: true };
    return { auditId: String(data) };
  } catch {
    return { error: true };
  }
}

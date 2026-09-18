import { canAccessOrganizationResource } from "@/lib/auth/organization-roles";
import type { OrganizationRole } from "@/lib/auth/organization-roles";
import { auditResultMetadata } from "./audit";
import { createDemoOrganizationFoundation, DEMO_ORGANIZATION_ID } from "./defaults";
import type {
  BusinessSettings,
  BusinessSettingsInput,
  Organization,
  OrganizationAuditEvent,
  OrganizationFoundationState,
  OrganizationMember,
} from "./types";

type GlobalStore = typeof globalThis & {
  __stsOrganizationFoundation?: OrganizationFoundationState;
};

function g() {
  return globalThis as GlobalStore;
}

export function getOrganizationFoundation(): OrganizationFoundationState {
  if (!g().__stsOrganizationFoundation) {
    g().__stsOrganizationFoundation = createDemoOrganizationFoundation();
  }
  return g().__stsOrganizationFoundation!;
}

export function resetOrganizationFoundation(state?: OrganizationFoundationState) {
  g().__stsOrganizationFoundation = state ?? createDemoOrganizationFoundation();
  return g().__stsOrganizationFoundation!;
}

export function getOrganization(organizationId: string): Organization | null {
  return getOrganizationFoundation().organizations.find((item) => item.id === organizationId) ?? null;
}

export function getOrganizationSettings(organizationId: string): BusinessSettings | null {
  return getOrganizationFoundation().settings.find((item) => item.organizationId === organizationId) ?? null;
}

export function getActiveMembership(organizationId: string, userId: string): OrganizationMember | null {
  return (
    getOrganizationFoundation().members.find(
      (item) => item.organizationId === organizationId && item.userId === userId && item.status === "active",
    ) ?? null
  );
}

export function listMembersForOrganization(organizationId: string, actor: OrganizationMember): OrganizationMember[] {
  if (actor.status !== "active" || actor.organizationId !== organizationId) return [];
  const members = getOrganizationFoundation().members.filter((item) => item.organizationId === organizationId);
  if (actor.role === "contractor" || actor.role === "client") {
    return members.filter((item) => item.userId === actor.userId);
  }
  if (actor.role === "owner" || actor.role === "administrator" || actor.role === "employee" || actor.role === "accountant") {
    return members;
  }
  return [];
}

export function listAuditEventsForOrganization(organizationId: string, actor: OrganizationMember): OrganizationAuditEvent[] {
  const access = canAccessOrganizationResource({
    role: actor.role,
    membershipStatus: actor.status,
    actorOrganizationId: actor.organizationId,
    resourceOrganizationId: organizationId,
    permission: "audit.read",
  });
  if (!access.allowed) return [];
  return getOrganizationFoundation().auditEvents.filter((item) => item.organizationId === organizationId);
}

export function recordOrganizationAudit(input: {
  organizationId: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata?: Record<string, unknown>;
}): OrganizationAuditEvent {
  const event: OrganizationAuditEvent = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: auditResultMetadata("success", input.metadata),
    createdAt: new Date().toISOString(),
  };
  getOrganizationFoundation().auditEvents.unshift(event);
  return event;
}

export class OrganizationAccessError extends Error {
  constructor(
    message: string,
    readonly code: "unauthorized" | "not_found" | "cross_organization" | "validation",
  ) {
    super(message);
    this.name = "OrganizationAccessError";
  }
}

export function updateOrganizationBusinessSettings(input: {
  organizationId: string;
  actorUserId: string;
  actorRole: OrganizationRole;
  actorStatus: OrganizationMember["status"];
  actorOrganizationId: string;
  values: BusinessSettingsInput;
}): { organization: Organization; settings: BusinessSettings; audit: OrganizationAuditEvent } {
  const access = canAccessOrganizationResource({
    role: input.actorRole,
    membershipStatus: input.actorStatus,
    actorOrganizationId: input.actorOrganizationId,
    resourceOrganizationId: input.organizationId,
    permission: "settings.business.write",
  });
  if (!access.allowed) {
    throw new OrganizationAccessError("Unauthorized", access.reason === "cross_organization" ? "cross_organization" : "unauthorized");
  }

  const state = getOrganizationFoundation();
  const organization = state.organizations.find((item) => item.id === input.organizationId);
  const settings = state.settings.find((item) => item.organizationId === input.organizationId);
  if (!organization || !settings) {
    throw new OrganizationAccessError("Organization settings were not found.", "not_found");
  }

  const now = new Date().toISOString();
  const previous = {
    legalName: organization.legalName,
    displayName: organization.displayName,
    timezone: organization.timezone,
    baseCurrency: organization.baseCurrency,
    fiscalYearStart: organization.fiscalYearStart,
    invoicePrefix: settings.invoicePrefix,
    estimatePrefix: settings.estimatePrefix,
    defaultPaymentTerms: settings.defaultPaymentTerms,
  };

  organization.legalName = input.values.legalName;
  organization.displayName = input.values.displayName;
  organization.timezone = input.values.timezone;
  organization.baseCurrency = input.values.baseCurrency;
  organization.fiscalYearStart = input.values.fiscalYearStart;
  organization.updatedAt = now;

  settings.invoicePrefix = input.values.invoicePrefix;
  settings.estimatePrefix = input.values.estimatePrefix;
  settings.defaultPaymentTerms = input.values.defaultPaymentTerms;
  settings.updatedAt = now;

  const audit = recordOrganizationAudit({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: "business_settings.updated",
    entityType: "business_settings",
    entityId: settings.id,
    metadata: {
      result: "success",
      changedFields: Object.keys(previous).filter((key) => previous[key as keyof typeof previous] !== input.values[key as keyof BusinessSettingsInput]),
      previous: {
        invoicePrefix: previous.invoicePrefix,
        estimatePrefix: previous.estimatePrefix,
        fiscalYearStart: previous.fiscalYearStart,
        baseCurrency: previous.baseCurrency,
        timezone: previous.timezone,
      },
      note: "Prefix and terms apply to new documents only. Historical documents are not rewritten.",
    },
  });

  return { organization, settings, audit };
}

export function demoOrganizationId() {
  return DEMO_ORGANIZATION_ID;
}

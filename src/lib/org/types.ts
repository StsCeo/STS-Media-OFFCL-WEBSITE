import type { MembershipStatus, OrganizationRole } from "@/lib/auth/organization-roles";

export interface Organization {
  id: string;
  legalName: string;
  displayName: string;
  slug: string;
  baseCurrency: string;
  timezone: string;
  fiscalYearStart: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  status: MembershipStatus;
  invitedAt: string;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BrandSettingsValue {
  paletteId: string;
  accentColor: string;
  logoText: string;
}

export interface NotificationSettingsValue {
  emailInvoices: boolean;
  emailEstimates: boolean;
}

export interface BusinessSettings {
  id: string;
  organizationId: string;
  invoicePrefix: string;
  estimatePrefix: string;
  defaultPaymentTerms: string;
  brandSettings: BrandSettingsValue;
  notificationSettings: NotificationSettingsValue;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationAuditEvent {
  id: string;
  organizationId: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface OrganizationFoundationState {
  organizations: Organization[];
  members: OrganizationMember[];
  settings: BusinessSettings[];
  auditEvents: OrganizationAuditEvent[];
}

export interface BusinessSettingsInput {
  legalName: string;
  displayName: string;
  timezone: string;
  baseCurrency: string;
  fiscalYearStart: number;
  invoicePrefix: string;
  estimatePrefix: string;
  defaultPaymentTerms: string;
}

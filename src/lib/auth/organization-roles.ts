export const ORGANIZATION_ROLES = [
  "owner",
  "administrator",
  "accountant",
  "employee",
  "contractor",
  "client",
] as const;

export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export const MEMBERSHIP_STATUSES = ["invited", "active", "disabled", "removed"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const BUSINESS_OS_SECTIONS = [
  "command-center",
  "crm",
  "estimates",
  "contracts",
  "projects",
  "invoices",
  "finance",
  "sheets",
  "taxes",
  "payroll",
  "documents",
  "calendar",
  "client-portal",
  "accountant",
  "reports",
  "integrations",
  "security",
  "business-settings",
] as const;

export type BusinessOsSectionId = (typeof BUSINESS_OS_SECTIONS)[number];

export type Permission =
  | `section.${BusinessOsSectionId}`
  | "settings.business.read"
  | "settings.business.write"
  | "security.ownership"
  | "credentials.read"
  | "audit.read"
  | "org.members.manage"
  | "records.cross-client"
  | "records.unassigned-work";

export type AccessDenialReason =
  | "unauthenticated"
  | "not_member"
  | "membership_inactive"
  | "missing_organization"
  | "cross_organization"
  | "role_denied"
  | "assigned_work_only"
  | "client_scope";

const ALL_SECTION_PERMISSIONS = BUSINESS_OS_SECTIONS.map(
  (section) => `section.${section}` as Permission,
);

const OWNER_PERMISSIONS: Permission[] = [
  ...ALL_SECTION_PERMISSIONS,
  "settings.business.read",
  "settings.business.write",
  "security.ownership",
  "credentials.read",
  "audit.read",
  "org.members.manage",
  "records.cross-client",
  "records.unassigned-work",
];

const ADMINISTRATOR_PERMISSIONS: Permission[] = OWNER_PERMISSIONS.filter(
  (permission) => permission !== "security.ownership" && permission !== "credentials.read",
);

const ACCOUNTANT_PERMISSIONS: Permission[] = [
  "section.command-center",
  "section.finance",
  "section.taxes",
  "section.invoices",
  "section.documents",
  "section.reports",
  "section.accountant",
  "settings.business.read",
];

const EMPLOYEE_PERMISSIONS: Permission[] = [
  "section.command-center",
  "section.crm",
  "section.estimates",
  "section.contracts",
  "section.projects",
  "section.documents",
  "section.calendar",
  "section.reports",
  "records.unassigned-work",
];

const CONTRACTOR_PERMISSIONS: Permission[] = [
  "section.command-center",
  "section.projects",
  "section.documents",
  "section.calendar",
];

const CLIENT_PERMISSIONS: Permission[] = ["section.client-portal"];

const ROLE_PERMISSIONS: Record<OrganizationRole, ReadonlySet<Permission>> = {
  owner: new Set(OWNER_PERMISSIONS),
  administrator: new Set(ADMINISTRATOR_PERMISSIONS),
  accountant: new Set(ACCOUNTANT_PERMISSIONS),
  employee: new Set(EMPLOYEE_PERMISSIONS),
  contractor: new Set(CONTRACTOR_PERMISSIONS),
  client: new Set(CLIENT_PERMISSIONS),
};

export function isOrganizationRole(value: string | null | undefined): value is OrganizationRole {
  return Boolean(value && (ORGANIZATION_ROLES as readonly string[]).includes(value));
}

export function hasPermission(role: OrganizationRole | null | undefined, permission: Permission) {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].has(permission);
}

export function mapLegacyRole(role: string | null | undefined): OrganizationRole | null {
  if (isOrganizationRole(role)) return role;
  if (role === "admin") return "administrator";
  return null;
}

export function canAccessOrganizationResource(input: {
  role: OrganizationRole | null | undefined;
  membershipStatus: MembershipStatus | null | undefined;
  actorOrganizationId: string | null | undefined;
  resourceOrganizationId: string | null | undefined;
  permission: Permission;
}): { allowed: boolean; reason: AccessDenialReason | "ok" } {
  if (!input.role) return { allowed: false, reason: "unauthenticated" };
  if (!input.membershipStatus) return { allowed: false, reason: "not_member" };
  if (input.membershipStatus !== "active") return { allowed: false, reason: "membership_inactive" };
  if (!input.actorOrganizationId || !input.resourceOrganizationId) {
    return { allowed: false, reason: "missing_organization" };
  }
  if (input.actorOrganizationId !== input.resourceOrganizationId) {
    return { allowed: false, reason: "cross_organization" };
  }
  if (!hasPermission(input.role, input.permission)) {
    return { allowed: false, reason: "role_denied" };
  }
  return { allowed: true, reason: "ok" };
}

export function canAccessAssignedWork(input: {
  role: OrganizationRole | null | undefined;
  assignedToActor: boolean;
}): { allowed: boolean; reason: AccessDenialReason | "ok" } {
  if (!input.role) return { allowed: false, reason: "unauthenticated" };
  if (input.role === "contractor" && !input.assignedToActor) {
    return { allowed: false, reason: "assigned_work_only" };
  }
  if (!hasPermission(input.role, "records.unassigned-work") && !input.assignedToActor) {
    if (input.role === "owner" || input.role === "administrator" || input.role === "employee") {
      return { allowed: true, reason: "ok" };
    }
    return { allowed: false, reason: "assigned_work_only" };
  }
  return { allowed: true, reason: "ok" };
}

export function canAccessClientRecord(input: {
  role: OrganizationRole | null | undefined;
  actorClientId: string | null | undefined;
  resourceClientId: string | null | undefined;
}): { allowed: boolean; reason: AccessDenialReason | "ok" } {
  if (!input.role) return { allowed: false, reason: "unauthenticated" };
  if (input.role !== "client") {
    return hasPermission(input.role, "records.cross-client")
      ? { allowed: true, reason: "ok" }
      : { allowed: false, reason: "role_denied" };
  }
  if (!input.actorClientId || !input.resourceClientId || input.actorClientId !== input.resourceClientId) {
    return { allowed: false, reason: "client_scope" };
  }
  return { allowed: true, reason: "ok" };
}

export function sectionPermission(section: BusinessOsSectionId): Permission {
  return `section.${section}`;
}

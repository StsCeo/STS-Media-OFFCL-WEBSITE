import type { SessionUser } from "@/lib/auth/session";
import { isDemoModeEnabled, isSupabaseConfigured } from "@/lib/config";
import { createSupabaseServer } from "@/lib/auth/session";
import { DEMO_ORGANIZATION_ID } from "@/lib/org/defaults";
import { loadOrganizationBundleFromDatabase } from "@/lib/org/database";
import { getActiveMembership, getOrganization, getOrganizationSettings, listAuditEventsForOrganization } from "@/lib/org/store";
import type { BusinessSettings, Organization, OrganizationAuditEvent, OrganizationMember } from "@/lib/org/types";

export type OrgDataSource = "demo-memory" | "postgres" | "none";

export interface BusinessOsContext {
  organizationId: string | null;
  organization: Organization | null;
  settings: BusinessSettings | null;
  audit: OrganizationAuditEvent[];
  membership: OrganizationMember | null;
  source: OrgDataSource;
  unavailable: boolean;
}

export async function getBusinessOsContext(user: SessionUser | null): Promise<BusinessOsContext> {
  const empty: BusinessOsContext = {
    organizationId: null,
    organization: null,
    settings: null,
    audit: [],
    membership: null,
    source: "none",
    unavailable: false,
  };
  if (!user) return empty;

  if (user.source === "demo" && isDemoModeEnabled()) {
    const organizationId = user.organizationId ?? DEMO_ORGANIZATION_ID;
    const membership = getActiveMembership(organizationId, user.id);
    const actor = membership ?? null;
    return {
      organizationId,
      organization: getOrganization(organizationId),
      settings: getOrganizationSettings(organizationId),
      audit: actor ? listAuditEventsForOrganization(organizationId, actor) : [],
      membership: actor,
      source: "demo-memory",
      unavailable: false,
    };
  }

  if (user.source === "supabase" && isSupabaseConfigured() && user.organizationId) {
    const factory = createSupabaseServer();
    if (!factory) return { ...empty, organizationId: user.organizationId, unavailable: true };
    const supabase = await factory();
    const loaded = await loadOrganizationBundleFromDatabase(supabase, user.organizationId);
    if ("error" in loaded) {
      return { ...empty, organizationId: user.organizationId, source: "postgres", unavailable: true };
    }
    return {
      organizationId: user.organizationId,
      organization: loaded.organization,
      settings: loaded.settings,
      audit: loaded.audit,
      membership: user.organizationRole && user.membershipStatus === "active"
        ? {
            id: "session-membership",
            organizationId: user.organizationId,
            userId: user.id,
            role: user.organizationRole,
            status: "active",
            invitedAt: "",
            acceptedAt: "",
            createdAt: "",
            updatedAt: "",
          }
        : null,
      source: "postgres",
      unavailable: false,
    };
  }

  return { ...empty, organizationId: user.organizationId ?? null };
}

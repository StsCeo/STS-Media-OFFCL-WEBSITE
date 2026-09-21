import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { DEMO_COOKIE, isDemoModeEnabled, isSupabaseConfigured } from "@/lib/config";
import { DEFAULT_OWNER_EMAIL, isAllowedOwnerEmail } from "@/lib/auth/owner";
import { demoSessionCookieOptions, verifyDemoSession } from "@/lib/auth/demo-session";
import {
  canAccessOrganizationResource,
  type MembershipStatus,
  type OrganizationRole,
  type Permission,
} from "@/lib/auth/organization-roles";
import { DEMO_ORGANIZATION_ID } from "@/lib/org/defaults";
import { readActiveMembership } from "@/lib/org/membership";
import type { Role } from "@/lib/types";

export type AuthStatus =
  | "demo"
  | "authenticated"
  | "needs_mfa"
  | "unauthenticated"
  | "unconfigured";

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  mfaVerified: boolean;
  emailVerified: boolean;
  source: "demo" | "supabase";
  organizationId?: string | null;
  organizationRole?: OrganizationRole | null;
  membershipStatus?: MembershipStatus | null;
}

export function createSupabaseServer() {
  if (!isSupabaseConfigured()) return null;
  return async function getClient() {
    const cookieStore = await cookies();
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(items) {
            try {
              items.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Called from a Server Component; proxy handles refreshes.
            }
          },
        },
      },
    );
  };
}

export async function getSession(): Promise<{ status: AuthStatus; user: SessionUser | null }> {
  if (isDemoModeEnabled()) {
    const jar = await cookies();
    const demo = await verifyDemoSession(jar.get(DEMO_COOKIE)?.value);
    if (demo?.mode === "owner") {
      return {
        status: "demo",
        user: {
          id: "user-owner",
          email: DEFAULT_OWNER_EMAIL,
          role: "owner",
          mfaVerified: true,
          emailVerified: true,
          source: "demo",
          organizationId: DEMO_ORGANIZATION_ID,
          organizationRole: "owner",
          membershipStatus: "active",
        },
      };
    }
    if (demo?.mode === "needs_mfa") {
      return {
        status: "needs_mfa",
        user: {
          id: "user-owner",
          email: DEFAULT_OWNER_EMAIL,
          role: "owner",
          mfaVerified: false,
          emailVerified: true,
          source: "demo",
          organizationId: DEMO_ORGANIZATION_ID,
          organizationRole: "owner",
          membershipStatus: "active",
        },
      };
    }
  }

  if (!isSupabaseConfigured()) {
    return { status: "unconfigured", user: null };
  }

  const factory = createSupabaseServer();
  if (!factory) return { status: "unconfigured", user: null };
  const supabase = await factory();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { status: "unauthenticated", user: null };

  const email = data.user.email ?? "";
  const membership = await readActiveMembership(supabase, data.user.id);
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const mfaVerified = assurance?.currentLevel === "aal2";
  const hasMembership = Boolean(membership);

  return {
    status: hasMembership && !mfaVerified ? "needs_mfa" : "authenticated",
    user: {
      id: data.user.id,
      email,
      role: sessionRoleFromOrganizationRole(membership?.role),
      mfaVerified,
      emailVerified: Boolean(data.user.email_confirmed_at),
      source: "supabase",
      organizationId: membership?.organizationId ?? null,
      organizationRole: membership?.role ?? null,
      membershipStatus: membership?.status ?? null,
    },
  };
}

export function sessionRoleFromOrganizationRole(role: OrganizationRole | null | undefined): Role {
  if (role === "owner") return "owner";
  if (role === "administrator") return "admin";
  if (role === "accountant") return "accountant";
  if (role === "client") return "client";
  return "contractor";
}

export function hasPrivilegedOrganizationRole(user: SessionUser | null) {
  if (!user) return false;
  if (user.membershipStatus !== "active") return false;
  if (!user.organizationId) return false;
  return user.organizationRole === "owner" || user.organizationRole === "administrator";
}

export function canAccessDashboard(user: SessionUser | null) {
  if (!user) return false;
  if (user.source === "demo") {
    if (!isDemoModeEnabled()) return false;
    if (user.role !== "owner") return false;
    if (!isAllowedOwnerEmail(user.email)) return false;
    return user.mfaVerified || isDemoModeEnabled();
  }
  if (!user.mfaVerified) return false;
  // Dashboard UI is still owner/administrator + AAL2. Protected data is also
  // denied at RLS/RPC/Storage unless the JWT aal claim is exactly aal2.
  // Accountants use canAccessAccountantCenter / /accountant, not this loader.
  return hasPrivilegedOrganizationRole(user);
}

export function hasAccountantReadRole(user: SessionUser | null) {
  if (!user) return false;
  if (user.membershipStatus !== "active") return false;
  if (!user.organizationId) return false;
  return (
    user.organizationRole === "owner" ||
    user.organizationRole === "administrator" ||
    user.organizationRole === "accountant"
  );
}

export function canAccessAccountantCenter(user: SessionUser | null) {
  if (!user) return false;
  if (user.source === "demo") {
    // Demo owner may review the read-only surface for oversight. Demo never
    // invents a disposable accountant identity.
    return canAccessDashboard(user);
  }
  if (!user.mfaVerified) return false;
  return hasAccountantReadRole(user);
}

export function hasClientPortalRole(user: SessionUser | null) {
  if (!user) return false;
  if (user.source === "demo") return false;
  if (user.membershipStatus !== "active") return false;
  if (!user.organizationId) return false;
  if (!user.mfaVerified) return false;
  return user.organizationRole === "client";
}

export function canAccessClientPortal(user: SessionUser | null) {
  return hasClientPortalRole(user);
}

export async function requireAccountantRead() {
  const session = await getSession();
  if (!canAccessAccountantCenter(session.user)) {
    throw new Error("Unauthorized");
  }
  const organizationId = sessionOrganizationId(session.user);
  if (!organizationId) {
    throw new Error("Unauthorized");
  }
  return { ...session, organizationId };
}

export async function requireClientPortal() {
  const session = await getSession();
  if (!canAccessClientPortal(session.user)) {
    throw new Error("Unauthorized");
  }
  const organizationId = sessionOrganizationId(session.user);
  if (!organizationId) {
    throw new Error("Unauthorized");
  }
  return { ...session, organizationId };
}

export async function requireOwnerWrite() {
  const session = await getSession();
  if (!canAccessDashboard(session.user)) {
    throw new Error("Unauthorized");
  }
  return session;
}

export function sessionOrganizationId(user: SessionUser | null | undefined): string | null {
  if (!user) return null;
  if (user.source === "demo") {
    if (!isDemoModeEnabled()) return null;
    return user.organizationId ?? DEMO_ORGANIZATION_ID;
  }
  return user.organizationId ?? null;
}

export function organizationRoleFor(user: SessionUser | null): OrganizationRole | null {
  if (!user) return null;
  return user.organizationRole ?? null;
}

export function canUseOrganizationPermission(
  user: SessionUser | null,
  permission: Permission,
  resourceOrganizationId?: string | null,
) {
  if (!user) return false;
  const organizationId = resourceOrganizationId ?? user.organizationId;
  const result = canAccessOrganizationResource({
    role: organizationRoleFor(user),
    membershipStatus: user.membershipStatus ?? null,
    actorOrganizationId: user.organizationId,
    resourceOrganizationId: organizationId,
    permission,
  });
  return result.allowed;
}

export async function requireBusinessSettingsWrite() {
  const session = await requireOwnerWrite();
  const user = session.user!;
  const organizationId = sessionOrganizationId(user);
  if (!organizationId) {
    throw new Error("Unauthorized");
  }
  if (
    !canUseOrganizationPermission(
      user,
      "settings.business.write",
      organizationId,
    )
  ) {
    throw new Error("Unauthorized");
  }
  return { ...session, organizationId };
}

export async function requireCrmWrite() {
  const session = await requireOwnerWrite();
  const user = session.user!;
  const organizationId = sessionOrganizationId(user);
  if (!organizationId) {
    throw new Error("Unauthorized");
  }
  if (!canUseOrganizationPermission(user, "section.crm", organizationId)) {
    throw new Error("Unauthorized");
  }
  return { ...session, organizationId };
}

export async function requireFinanceWrite() {
  const session = await requireOwnerWrite();
  const user = session.user!;
  const organizationId = sessionOrganizationId(user);
  if (!organizationId) {
    throw new Error("Unauthorized");
  }
  const role = organizationRoleFor(user);
  if (role !== "owner" && role !== "administrator" && role !== "employee") {
    throw new Error("Unauthorized");
  }
  return { ...session, organizationId };
}

export async function requireRevenueWrite() {
  const session = await requireOwnerWrite();
  const user = session.user!;
  const organizationId = sessionOrganizationId(user);
  if (!organizationId) {
    throw new Error("Unauthorized");
  }
  if (!canUseOrganizationPermission(user, "section.finance", organizationId)) {
    throw new Error("Unauthorized");
  }
  const role = organizationRoleFor(user);
  if (role !== "owner" && role !== "administrator") {
    throw new Error("Unauthorized");
  }
  return { ...session, organizationId };
}

export async function requireOperationsWrite() {
  const session = await requireOwnerWrite();
  const user = session.user!;
  const organizationId = sessionOrganizationId(user);
  if (!organizationId) {
    throw new Error("Unauthorized");
  }
  if (!canUseOrganizationPermission(user, "section.projects", organizationId)) {
    throw new Error("Unauthorized");
  }
  return { ...session, organizationId };
}

export async function requireInvoiceWrite() {
  const session = await requireOwnerWrite();
  const user = session.user!;
  const organizationId = sessionOrganizationId(user);
  if (!organizationId) {
    throw new Error("Unauthorized");
  }
  if (!canUseOrganizationPermission(user, "section.invoices", organizationId)) {
    throw new Error("Unauthorized");
  }
  const role = organizationRoleFor(user);
  if (role !== "owner" && role !== "administrator") {
    throw new Error("Unauthorized");
  }
  return { ...session, organizationId };
}

export async function requireEstimateWrite() {
  const session = await requireOwnerWrite();
  const user = session.user!;
  const organizationId = sessionOrganizationId(user);
  if (!organizationId) {
    throw new Error("Unauthorized");
  }
  if (!canUseOrganizationPermission(user, "section.estimates", organizationId)) {
    throw new Error("Unauthorized");
  }
  const role = organizationRoleFor(user);
  if (role !== "owner" && role !== "administrator") {
    throw new Error("Unauthorized");
  }
  return { ...session, organizationId };
}

export async function clearCurrentAuth() {
  const jar = await cookies();
  const cookie = demoSessionCookieOptions(0);
  jar.set(DEMO_COOKIE, "", cookie);
  jar.delete({
    name: DEMO_COOKIE,
    path: cookie.path,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
  });

  if (!isSupabaseConfigured()) return;
  const factory = createSupabaseServer();
  if (!factory) return;
  try {
    const supabase = await factory();
    await supabase.auth.signOut();
  } catch {
    // Demo cookie is already cleared; continue even if Supabase sign-out fails.
  }
  for (const item of jar.getAll()) {
    if (!item.name.includes("-auth-token")) continue;
    jar.set(item.name, "", { ...cookie, maxAge: 0 });
    jar.delete({
      name: item.name,
      path: cookie.path,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
    });
  }
}

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { DEMO_COOKIE, isDemoModeEnabled, isSupabaseConfigured } from "@/lib/config";
import { DEFAULT_OWNER_EMAIL, isAllowedOwnerEmail } from "@/lib/auth/owner";
import { demoSessionCookieOptions, verifyDemoSession } from "@/lib/auth/demo-session";
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
  if (!isAllowedOwnerEmail(email)) {
    return { status: "unauthenticated", user: null };
  }

  const aal = data.user.factors?.length ? "aal2-unknown" : "aal1";
  const mfaVerified = aal !== "aal1" && (data.user.app_metadata?.mfa_verified === true || false);

  return {
    status: mfaVerified ? "authenticated" : "needs_mfa",
    user: {
      id: data.user.id,
      email,
      role: "owner",
      mfaVerified,
      emailVerified: Boolean(data.user.email_confirmed_at),
      source: "supabase",
    },
  };
}

export function canAccessDashboard(user: SessionUser | null) {
  if (!user) return false;
  if (user.role !== "owner") return false;
  if (!isAllowedOwnerEmail(user.email)) return false;
  return user.mfaVerified || user.source === "demo";
}

export async function requireOwnerWrite() {
  const session = await getSession();
  if (!canAccessDashboard(session.user)) {
    throw new Error("Unauthorized");
  }
  return session;
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
}

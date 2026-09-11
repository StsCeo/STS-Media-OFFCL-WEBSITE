import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { DEMO_COOKIE, isDemoModeEnabled, isSupabaseConfigured } from "@/lib/config";
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
    const demo = jar.get(DEMO_COOKIE)?.value;
    if (demo === "owner") {
      return {
        status: "demo",
        user: {
          id: "user-owner",
          email: "owner@stsmedia.co",
          role: "owner",
          mfaVerified: true,
          emailVerified: true,
          source: "demo",
        },
      };
    }
    if (demo === "needs_mfa") {
      return {
        status: "needs_mfa",
        user: {
          id: "user-owner",
          email: "owner@stsmedia.co",
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

  const aal = data.user.factors?.length ? "aal2-unknown" : "aal1";
  const mfaVerified = aal !== "aal1" && (data.user.app_metadata?.mfa_verified === true || false);
  const role = (data.user.app_metadata?.role as Role) || "contractor";

  return {
    status: mfaVerified || role === "client" ? "authenticated" : "needs_mfa",
    user: {
      id: data.user.id,
      email: data.user.email ?? "",
      role,
      mfaVerified,
      emailVerified: Boolean(data.user.email_confirmed_at),
      source: "supabase",
    },
  };
}

export function canAccessDashboard(user: SessionUser | null) {
  if (!user) return false;
  if (user.role === "client") return false;
  return user.mfaVerified || user.source === "demo";
}

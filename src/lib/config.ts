export const APP_NAME = "STS Media";
export const LEGAL_NAME = "Scars to Stars Media";
export const SITE_HOST = "stsmedia.co";

export const DEMO_COOKIE = "sts_demo_session";
export const THEME_COOKIE = "sts_theme";
export const SIDEBAR_COOKIE = "sts_sidebar";

export const OWNER_ROLES = ["owner", "admin"] as const;
export const MFA_REQUIRED_ROLES = ["owner", "admin"] as const;

export const PUBLIC_PATHS = [
  "/",
  "/work",
  "/services",
  "/packages",
  "/about",
  "/process",
  "/testimonials",
  "/contact",
  "/legal",
];

export const AUTH_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/password-changed",
  "/verify-email",
  "/invite",
  "/mfa",
  "/auth",
  "/unauthorized",
  "/session-expired",
  "/sign-out",
];

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function isDemoModeEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE === "true";
}

export function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

import { NextResponse, type NextRequest } from "next/server";
import { DEMO_COOKIE, isDemoModeEnabled } from "@/lib/config";
import { verifyDemoSession } from "@/lib/auth/demo-session";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

const PROTECTED = ["/dashboard"];
const MFA_PATH = "/mfa/verify";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = await updateSupabaseSession(request);

  const isProtected = PROTECTED.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (!isProtected) return response;

  const demo = isDemoModeEnabled()
    ? await verifyDemoSession(request.cookies.get(DEMO_COOKIE)?.value)
    : null;
  if (demo?.mode === "owner") return response;
  if (demo?.mode === "needs_mfa" && pathname.startsWith("/mfa")) return response;
  if (demo?.mode === "needs_mfa") {
    const url = request.nextUrl.clone();
    url.pathname = MFA_PATH;
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const hasSupabaseAuth = request.cookies.getAll().some((cookie) => cookie.name.includes("-auth-token"));
  if (hasSupabaseAuth) return response;

  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/dashboard/:path*", "/dashboard"],
};

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isSafeRedirect } from "@/lib/utils";
import { isSupabaseConfigured } from "@/lib/config";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = isSafeRedirect(url.searchParams.get("next")) ? url.searchParams.get("next")! : "/dashboard";
  const code = url.searchParams.get("code");
  if (!code || !isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/auth/expired", url.origin));
  }
  // Exchange happens in a route handler with cookies set on the response.
  const response = NextResponse.redirect(new URL(next, url.origin));
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll(items) {
          items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  await supabase.auth.exchangeCodeForSession(code);
  return response;
}

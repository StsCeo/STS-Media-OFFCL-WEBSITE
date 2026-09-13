import { LoginForm } from "@/components/auth/login-form";
import { AuthShell } from "@/components/auth/shell";
import { isDemoSessionConfigured } from "@/lib/auth/demo-session";
import { isDemoModeEnabled, isSupabaseConfigured } from "@/lib/config";
import { isSafeRedirect } from "@/lib/utils";

export const metadata = { title: "Owner sign-in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const next = isSafeRedirect(String(params.next || "")) ? String(params.next) : "/dashboard";
  return (
    <AuthShell title="Owner sign-in">
      <LoginForm
        next={next}
        demoEnabled={isDemoModeEnabled() && isDemoSessionConfigured()}
        supabaseConfigured={isSupabaseConfigured()}
      />
    </AuthShell>
  );
}

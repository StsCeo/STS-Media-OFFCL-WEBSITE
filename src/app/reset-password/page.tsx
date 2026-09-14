import { AuthFlowUnavailable } from "@/components/auth/unavailable";
import { ResetPasswordForm } from "@/components/auth/recovery-forms";
import { AuthShell } from "@/components/auth/shell";
import { createSupabaseServer } from "@/lib/auth/session";
import { describeAuthFlowState } from "@/lib/auth/phase1-flows";
import { isProductionEnv, isSupabaseConfigured } from "@/lib/config";

export const metadata = { title: "Create a new password" };

export default async function ResetPasswordPage() {
  const state = describeAuthFlowState({
    backendConfigured: isSupabaseConfigured(),
    hasServerVerifiedSession: await hasVerifiedAuthUser(),
    production: isProductionEnv(),
  });

  if (!state.allowForm) {
    return <AuthFlowUnavailable title="Create a new password" state={state} />;
  }

  return (
    <AuthShell title="Create a new password" description="Choose a strong password. After it is changed, other sessions are revoked.">
      <ResetPasswordForm />
    </AuthShell>
  );
}

async function hasVerifiedAuthUser() {
  if (!isSupabaseConfigured()) return false;
  const factory = createSupabaseServer();
  if (!factory) return false;
  const supabase = await factory();
  const { data } = await supabase.auth.getUser();
  return Boolean(data.user);
}

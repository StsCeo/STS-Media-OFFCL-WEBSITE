import { AuthFlowUnavailable } from "@/components/auth/unavailable";
import { InviteAcceptForm } from "@/components/auth/recovery-forms";
import { AuthShell } from "@/components/auth/shell";
import { createSupabaseServer } from "@/lib/auth/session";
import { describeAuthFlowState } from "@/lib/auth/phase1-flows";
import { isProductionEnv, isSupabaseConfigured } from "@/lib/config";

export default async function InviteAcceptPage() {
  const state = describeAuthFlowState({
    backendConfigured: isSupabaseConfigured(),
    hasServerVerifiedSession: await hasVerifiedAuthUser(),
    production: isProductionEnv(),
  });

  if (!state.allowForm) {
    return <AuthFlowUnavailable title="Accept invitation" state={state} />;
  }

  return (
    <AuthShell title="Accept invitation" description="Set the initial password for this invited account. Public signup is not available.">
      <InviteAcceptForm />
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

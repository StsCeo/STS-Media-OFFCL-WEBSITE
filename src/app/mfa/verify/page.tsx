import { AuthFlowUnavailable } from "@/components/auth/unavailable";
import { AuthShell } from "@/components/auth/shell";
import { MfaVerifyForm } from "@/components/auth/recovery-forms";
import { describeMfaPage } from "@/lib/auth/phase1-flows";
import { isDemoModeEnabled, isProductionEnv, isSupabaseConfigured } from "@/lib/config";

export const metadata = { title: "MFA challenge" };

export default function MfaVerifyPage() {
  const state = describeMfaPage({
    demoMode: isDemoModeEnabled(),
    backendConfigured: isSupabaseConfigured(),
    hasProviderChallenge: false,
    production: isProductionEnv(),
  });

  if (!state.allowForm) {
    return <AuthFlowUnavailable title="Two-factor challenge" state={state} />;
  }

  return (
    <AuthShell title="Two-factor challenge" description="Enter a code from your authenticator app. This check is enforced on the server, not only in the browser.">
      <MfaVerifyForm />
    </AuthShell>
  );
}

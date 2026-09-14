import { AuthFlowUnavailable } from "@/components/auth/unavailable";
import { describeMfaPage } from "@/lib/auth/phase1-flows";
import { isDemoModeEnabled, isProductionEnv, isSupabaseConfigured } from "@/lib/config";

export default function MfaRecoveryPage() {
  const state = describeMfaPage({
    demoMode: isDemoModeEnabled(),
    backendConfigured: isSupabaseConfigured(),
    hasProviderChallenge: false,
    production: isProductionEnv(),
  });

  return <AuthFlowUnavailable title="Recover MFA" state={state} />;
}

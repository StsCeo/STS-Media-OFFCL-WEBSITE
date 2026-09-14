import { AuthFlowUnavailable } from "@/components/auth/unavailable";
import { describeMfaPage } from "@/lib/auth/phase1-flows";
import { isDemoModeEnabled, isProductionEnv, isSupabaseConfigured } from "@/lib/config";

export const metadata = { title: "Enroll MFA" };

export default function MfaEnrollPage() {
  const state = describeMfaPage({
    demoMode: isDemoModeEnabled(),
    backendConfigured: isSupabaseConfigured(),
    hasProviderChallenge: false,
    production: isProductionEnv(),
  });

  return <AuthFlowUnavailable title="Protect this account" state={state} />;
}

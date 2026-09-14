import { AuthFlowUnavailable } from "@/components/auth/unavailable";
import { describeAuthFlowState } from "@/lib/auth/phase1-flows";
import { isProductionEnv, isSupabaseConfigured } from "@/lib/config";

export default function PasswordChangedPage() {
  const state = describeAuthFlowState({
    backendConfigured: isSupabaseConfigured(),
    hasServerVerifiedSession: false,
    production: isProductionEnv(),
  });
  return <AuthFlowUnavailable title="Password change" state={{ ...state, message: "This page does not report a password change unless a server-verified reset completed." }} />;
}

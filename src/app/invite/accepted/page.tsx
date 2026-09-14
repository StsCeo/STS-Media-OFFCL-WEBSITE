import { AuthFlowUnavailable } from "@/components/auth/unavailable";
import { describeAuthFlowState } from "@/lib/auth/phase1-flows";
import { isProductionEnv, isSupabaseConfigured } from "@/lib/config";

export default function InviteAcceptedPage() {
  const state = describeAuthFlowState({
    backendConfigured: isSupabaseConfigured(),
    hasServerVerifiedSession: false,
    production: isProductionEnv(),
  });
  return <AuthFlowUnavailable title="Invitation" state={{ ...state, message: "This page does not report an accepted invitation unless a server-verified token completed the flow." }} />;
}

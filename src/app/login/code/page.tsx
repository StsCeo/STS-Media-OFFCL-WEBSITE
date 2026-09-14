import { AuthFlowUnavailable } from "@/components/auth/unavailable";
import { EmailCodeForm } from "@/components/auth/recovery-forms";
import { AuthShell } from "@/components/auth/shell";
import { describeAuthFlowState } from "@/lib/auth/phase1-flows";
import { isProductionEnv, isSupabaseConfigured } from "@/lib/config";

export default function CodePage() {
  const state = describeAuthFlowState({
    backendConfigured: isSupabaseConfigured(),
    hasServerVerifiedSession: false,
    production: isProductionEnv(),
  });

  if (!isSupabaseConfigured()) {
    return <AuthFlowUnavailable title="Enter verification code" state={state} />;
  }

  return (
    <AuthShell title="Enter verification code" description="Codes expire and cannot be reused. We will not confirm whether an email has an account.">
      <EmailCodeForm />
    </AuthShell>
  );
}

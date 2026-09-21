import { redirect } from "next/navigation";
import { AuthFlowUnavailable } from "@/components/auth/unavailable";
import { AuthShell } from "@/components/auth/shell";
import { MfaVerifyForm } from "@/components/auth/recovery-forms";
import { describeMfaPage } from "@/lib/auth/phase1-flows";
import { canAccessAccountantCenter, canAccessClientPortal, canAccessDashboard, getSession } from "@/lib/auth/session";
import { isDemoModeEnabled, isProductionEnv, isSupabaseConfigured } from "@/lib/config";
import { isSafeRedirect } from "@/lib/utils";

export const metadata = { title: "MFA challenge" };

export default async function MfaVerifyPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const session = await getSession();
  const hasProviderChallenge = Boolean(
    isSupabaseConfigured() && !isDemoModeEnabled() && session.user && session.status === "needs_mfa",
  );
  const state = describeMfaPage({
    demoMode: isDemoModeEnabled(),
    backendConfigured: isSupabaseConfigured(),
    hasProviderChallenge,
    production: isProductionEnv(),
  });

  if (session.user?.mfaVerified) {
    const next = typeof params.next === "string" && isSafeRedirect(params.next) ? params.next : "";
    if (next) redirect(next);
    if (canAccessAccountantCenter(session.user) && !canAccessDashboard(session.user)) {
      redirect("/accountant");
    }
    if (canAccessClientPortal(session.user) && !canAccessDashboard(session.user)) {
      redirect("/client");
    }
    redirect("/dashboard");
  }

  if (!session.user) {
    redirect("/login");
  }

  if (!state.allowForm) {
    return <AuthFlowUnavailable title="Two-factor challenge" state={state} />;
  }

  return (
    <AuthShell title="Two-factor challenge" description="Enter a code from your authenticator app. This check is enforced on the server, not only in the browser.">
      <MfaVerifyForm next={typeof params.next === "string" ? params.next : "/dashboard"} />
    </AuthShell>
  );
}

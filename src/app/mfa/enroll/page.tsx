import { redirect } from "next/navigation";
import { AuthFlowUnavailable } from "@/components/auth/unavailable";
import { AuthShell } from "@/components/auth/shell";
import { MfaEnrollForm } from "@/components/auth/mfa-enroll-form";
import { describeMfaEnrollmentAccess } from "@/lib/auth/mfa-enroll";
import { getSession } from "@/lib/auth/session";
import { isDemoModeEnabled, isProductionEnv, isSupabaseConfigured } from "@/lib/config";

export const metadata = { title: "Enroll MFA" };

export default async function MfaEnrollPage() {
  const session = await getSession();
  if (!session.user) {
    redirect("/login?next=/mfa/enroll");
  }

  const authorized = session.user.membershipStatus === "active" && Boolean(session.user.organizationId);
  const access = describeMfaEnrollmentAccess({
    signedIn: true,
    authorized,
    recentAuth: true,
    demoMode: isDemoModeEnabled(),
    backendConfigured: isSupabaseConfigured(),
  });

  if (!access.allowed) {
    return (
      <AuthFlowUnavailable
        title="Protect this account"
        state={{
          status: "not_configured",
          heading: "Not available",
          message: access.message,
          allowForm: false,
        }}
      />
    );
  }

  void isProductionEnv();

  return (
    <AuthShell
      title="Protect this account"
      description="Enroll an authenticator app. Only this signed-in account can complete enrollment. Secrets are not stored in the page URL."
    >
      <MfaEnrollForm />
    </AuthShell>
  );
}

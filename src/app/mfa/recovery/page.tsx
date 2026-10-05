import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/shell";
import { MFA_RECOVERY_UNAVAILABLE } from "@/lib/auth/mfa-enroll";
import { getSession } from "@/lib/auth/session";
import { isDemoModeEnabled, isSupabaseConfigured } from "@/lib/config";

export const metadata = { title: "Recover MFA" };

export default async function MfaRecoveryPage() {
  const session = await getSession();
  if (!session.user) {
    redirect("/login?next=/mfa/recovery");
  }
  if (isDemoModeEnabled() || !isSupabaseConfigured()) {
    redirect("/login");
  }

  return (
    <AuthShell title="Recover MFA" description={MFA_RECOVERY_UNAVAILABLE}>
      <div className="space-y-3 text-sm">
        <p>Unfinished enrollment can be cancelled from the enrollment page. A verified authenticator is still required for Command Center access.</p>
        <p>
          <Link className="underline" href="/mfa/enroll">
            Return to enrollment
          </Link>
        </p>
        <p>
          <Link className="underline" href="/mfa/verify">
            Enter an authenticator code
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}

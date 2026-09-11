import { AuthShell } from "@/components/auth/shell";
import { Button } from "@/components/ui";

export default function MfaRecoveryPage() {
  return (
    <AuthShell title="Recover MFA" description="Recovery uses only provider-supported methods. Recent authentication is required before MFA settings change.">
      <ul className="list-disc space-y-2 pl-5 text-sm text-soft-gray">
        <li>Use a backup TOTP factor if one was enrolled.</li>
        <li>Use a recovery code only if you saved it at enrollment. Codes are never shown again.</li>
        <li>An owner must verify identity before resetting another administrator’s MFA.</li>
        <li>Every recovery attempt is written to the security audit log — without codes or secrets.</li>
      </ul>
      <Button href="/login" className="mt-6 w-full">Return to sign in</Button>
    </AuthShell>
  );
}

import { AuthShell } from "@/components/auth/shell";
import { Button } from "@/components/ui";

export default function PasswordChangedPage() {
  return (
    <AuthShell title="Password changed" description="A confirmation email is sent when Auth is connected. Other sessions are revoked.">
      <p className="text-sm text-soft-gray">If you did not make this change, report it from the security page after signing in, or contact the owner.</p>
      <Button href="/login" className="mt-6 w-full">Sign in</Button>
      <Button href="/dashboard/settings/security" variant="secondary" className="mt-3 w-full">Report unauthorized change</Button>
    </AuthShell>
  );
}

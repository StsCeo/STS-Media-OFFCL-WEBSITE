import { AuthShell } from "@/components/auth/shell";
import { Button } from "@/components/ui";

export default function InviteAcceptedPage() {
  return (
    <AuthShell title="Invitation accepted" description="Enroll MFA before accessing owner or admin tools.">
      <Button href="/mfa/enroll" className="w-full">Enroll authenticator</Button>
    </AuthShell>
  );
}

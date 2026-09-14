import { AuthShell } from "@/components/auth/shell";
import { Button } from "@/components/ui";

export default function InviteExpiredPage() {
  return (
    <AuthShell title="Invitation expired" description="Ask an owner or admin to send a new invite. This link cannot be reused.">
      <Button href="/login" className="w-full">Return to sign in</Button>
    </AuthShell>
  );
}

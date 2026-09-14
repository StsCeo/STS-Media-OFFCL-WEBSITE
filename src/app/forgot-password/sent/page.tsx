import { AuthShell } from "@/components/auth/shell";
import { Button } from "@/components/ui";

export default function ResetSentPage() {
  return (
    <AuthShell title="Check your email" description="If an account exists, a reset link is on the way. We do not reveal whether the address is registered.">
      <Button href="/login" className="w-full">Return to sign in</Button>
    </AuthShell>
  );
}

import { AuthShell } from "@/components/auth/shell";
import { Button } from "@/components/ui";

export default function LockedPage() {
  return (
    <AuthShell title="Temporarily locked" description="Too many sign-in attempts from this network. Wait and try again. This is generic on purpose.">
      <Button href="/login" className="w-full">Return to sign in</Button>
    </AuthShell>
  );
}

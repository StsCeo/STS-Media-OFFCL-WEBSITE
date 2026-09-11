import { AuthShell } from "@/components/auth/shell";
import { Button } from "@/components/ui";

export default function SessionExpiredPage() {
  return (
    <AuthShell title="Session expired" description="Sign in again. Admin sessions time out with inactivity.">
      <Button href="/login" className="w-full">Sign in</Button>
    </AuthShell>
  );
}

import { AuthShell } from "@/components/auth/shell";
import { Button } from "@/components/ui";

export default function ExpiredLinkPage() {
  return (
    <AuthShell title="Link expired or invalid" description="Request a new email. Old codes and links cannot be reused.">
      <Button href="/login" className="w-full">Return to sign in</Button>
    </AuthShell>
  );
}

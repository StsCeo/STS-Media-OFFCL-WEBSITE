import { AuthShell } from "@/components/auth/shell";
import { Button } from "@/components/ui";

export default function UnauthorizedPage() {
  return (
    <AuthShell title="Unauthorized" description="This account does not have permission for that area. Client records are isolated by workspace.">
      <Button href="/" className="w-full">Go to the public site</Button>
      <Button href="/login" variant="secondary" className="mt-3 w-full">Sign in</Button>
    </AuthShell>
  );
}

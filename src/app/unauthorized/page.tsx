import { AuthShell } from "@/components/auth/shell";
import { Button } from "@/components/ui";

export default function UnauthorizedPage() {
  return (
    <AuthShell title="Unauthorized" description="This account does not have permission for that area. Sign-in is for the owner. Clients use the contact form.">
      <Button href="/" className="w-full">Go to the public site</Button>
      <Button href="/login" variant="secondary" className="mt-3 w-full">Sign in</Button>
    </AuthShell>
  );
}

import { AuthShell } from "@/components/auth/shell";
import { Button } from "@/components/ui";

export default function VerifyEmailPage() {
  return (
    <AuthShell title="Verify your email" description="Owner and admin access requires a verified email address.">
      <p className="text-sm text-soft-gray">Open the verification email from Supabase Auth, then continue. Expired links go to the expired-link screen.</p>
      <Button href="/login" className="mt-6 w-full">Return to sign in</Button>
    </AuthShell>
  );
}

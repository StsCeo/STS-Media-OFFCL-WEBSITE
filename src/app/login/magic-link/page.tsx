import { AuthShell } from "@/components/auth/shell";
import { Button } from "@/components/ui";

export const metadata = { title: "Magic link" };

export default function MagicLinkPage() {
  return (
    <AuthShell title="Open your magic link" description="Check the inbox for a single-use, time-limited sign-in link. Redirects only go to approved application URLs.">
      <p className="text-sm text-soft-gray">
        If you requested a link, it will arrive only when the email belongs to an invited account and Supabase Auth is connected. This page never reveals whether an address has an account.
      </p>
      <Button href="/login" className="mt-6 w-full">
        Return to sign in
      </Button>
    </AuthShell>
  );
}

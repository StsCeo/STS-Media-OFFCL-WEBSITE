import { AuthShell } from "@/components/auth/shell";
import { Button } from "@/components/ui";
import { endDemoSession } from "@/app/actions";

export default async function SignOutPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const params = await searchParams;
  const done = params.done === "1";
  return (
    <AuthShell title={done ? "Signed out" : "Sign out?"} description={done ? "This device session is closed." : "You can also revoke other devices from Security after signing back in."}>
      {done ? (
        <Button href="/login" className="w-full">Sign in</Button>
      ) : (
        <form action={endDemoSession} className="space-y-3">
          <p className="text-sm text-soft-gray">Confirm to end this session.</p>
          <Button href="/dashboard" variant="secondary" className="w-full">Stay signed in</Button>
          <Button type="submit" className="w-full">Sign out</Button>
        </form>
      )}
    </AuthShell>
  );
}

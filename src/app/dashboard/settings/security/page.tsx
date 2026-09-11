import { endDemoSession } from "@/app/actions";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Security" };

export default function SecurityPage() {
  const { sessions, securityEvents } = getWorkspace();
  return (
    <div>
      <PageHeader title="Security" description="Sessions, MFA, and security events. Secrets are never logged." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Active sessions</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {sessions.map((session) => (
              <li key={session.id} className="rounded-md border border-line p-3">
                <p>{session.device} · {session.browser}</p>
                <p className="text-xs text-muted">{session.location} · {session.lastActive}</p>
                {session.current ? <Badge tone="success">This device</Badge> : <Button size="sm" variant="secondary" className="mt-2">Revoke</Button>}
              </li>
            ))}
          </ul>
          <form action={endDemoSession} className="mt-4">
            <Button type="submit" variant="danger">Sign out of this device</Button>
          </form>
          <p className="mt-2 text-xs text-muted">Sign out of all other devices is available after Supabase Auth session listing is connected.</p>
        </Card>
        <Card>
          <h2 className="font-semibold">Factors</h2>
          <p className="mt-2 text-sm">Password · TOTP MFA · recovery instructions</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button href="/reset-password" size="sm">Change password</Button>
            <Button href="/mfa/enroll" size="sm" variant="secondary">Add MFA factor</Button>
            <Button href="/mfa/recovery" size="sm" variant="secondary">Recovery</Button>
          </div>
          <p className="mt-3 text-xs text-muted">Reauthentication is required before email, password, MFA, or integration credential changes when Auth is live.</p>
        </Card>
      </div>
      <Card className="mt-4">
        <h2 className="font-semibold">Security activity</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {securityEvents.map((event) => (
            <li key={event.id}>{event.at} · {event.type.replaceAll("_", " ")} · {event.detail}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

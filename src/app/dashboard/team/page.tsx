import { Badge, Card, PageHeader } from "@/components/ui";
import { DEFAULT_OWNER_EMAIL } from "@/lib/auth/owner";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Owner account" };

export default function TeamPage() {
  const team = getWorkspace().team;
  return (
    <div>
      <PageHeader title="Owner account" description="Phase 1 is owner-only. There are no team seats, accountant logins, or client passwords." />
      <Card className="mb-4">
        <h2 className="font-semibold">Allowlisted owner</h2>
        <p className="mt-2 font-mono text-sm">{DEFAULT_OWNER_EMAIL}</p>
        <p className="mt-3 text-sm text-muted">Additional seats and invites are not part of Phase 1. There is no client login.</p>
      </Card>
      {team.map((member) => (
        <Card key={member.id}>
          <p className="font-semibold">{member.name}</p>
          <p className="text-sm">{member.email} · {member.role}</p>
          <p className="text-xs text-muted">MFA required: {member.mfaRequired ? "yes" : "no"} · enrolled: {member.mfaEnrolled ? "yes" : "not yet"}</p>
          <div className="mt-2">
            <Badge>Owner</Badge>
          </div>
        </Card>
      ))}
    </div>
  );
}

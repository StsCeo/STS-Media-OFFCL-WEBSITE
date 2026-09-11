import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Team" };

const roles = ["Owner", "Admin", "COO", "Executive assistant", "Content strategist", "Scriptwriter", "Reviewer", "Contractor", "Accountant/view-only", "Client"];

export default function TeamPage() {
  const team = getWorkspace().team;
  return (
    <div>
      <PageHeader title="Team" description="Invite-only. Least privilege. MFA can be required by role. Client identities are isolated." />
      <Card className="mb-4">
        <h2 className="font-semibold">Roles prepared</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {roles.map((role) => <Badge key={role}>{role}</Badge>)}
        </div>
        <p className="mt-3 text-sm text-muted">Invites require Supabase Auth. There is no public registration.</p>
        <Button className="mt-4" href="/invite/accept">Preview invite acceptance</Button>
      </Card>
      {team.map((member) => (
        <Card key={member.id}>
          <p className="font-semibold">{member.name}</p>
          <p className="text-sm">{member.email} · {member.role}</p>
          <p className="text-xs text-muted">MFA required: {member.mfaRequired ? "yes" : "no"} · enrolled: {member.mfaEnrolled ? "yes" : "not yet"}</p>
        </Card>
      ))}
    </div>
  );
}

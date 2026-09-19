import { Badge, Button, Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Security & Ownership" };

export default function SecurityOwnershipPage() {
  return (
    <div>
      <PageHeader
        eyebrow="STS Media Business OS"
        title="Security & Ownership"
        description="Owner-only security controls. Hidden buttons are not authorization — the server still requires the allowlisted owner."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <Badge tone="success">Available</Badge>
          <h2 className="mt-3 font-semibold">Sessions and MFA</h2>
          <p className="mt-2 text-sm text-muted">Password, MFA, session list, and the existing security audit trail.</p>
          <Button href="/dashboard/settings/security" size="sm" className="mt-4">
            Open security settings
          </Button>
        </Card>
        <Card>
          <Badge tone="success">Available</Badge>
          <h2 className="mt-3 font-semibold">Owner account</h2>
          <p className="mt-2 text-sm text-muted">The Phase 1 dashboard remains invite-only for the configured owner allowlist. Additional roles are modeled but not invited yet.</p>
          <Button href="/dashboard/team" size="sm" className="mt-4">
            Open owner account
          </Button>
        </Card>
        <Card>
          <Badge>Planned</Badge>
          <h2 className="mt-3 font-semibold">Organization transfer</h2>
          <p className="mt-2 text-sm text-muted">Transferring ownership requires owner approval and is not available today.</p>
        </Card>
        <Card>
          <Badge>Planned</Badge>
          <h2 className="mt-3 font-semibold">Credential vault</h2>
          <p className="mt-2 text-sm text-muted">API keys, payroll logins, and banking passwords are not stored in ordinary fields and are not collected here.</p>
        </Card>
      </div>
    </div>
  );
}

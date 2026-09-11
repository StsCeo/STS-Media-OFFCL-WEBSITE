import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Integrations" };

export default function IntegrationsPage() {
  const items = getWorkspace().integrations;
  return (
    <div>
      <PageHeader title="Integrations" description="OAuth, webhooks, and encrypted tokens are the production path. No account is shown as connected without credentials." />
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <Card key={item.id} id={item.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">{item.name}</h2>
                <p className="text-sm text-muted">{item.description}</p>
              </div>
              <Badge tone={item.status === "connected" ? "success" : item.status === "error" ? "danger" : item.status === "coming_soon" ? "demo" : "warning"}>
                {item.status.replaceAll("_", " ")}
              </Badge>
            </div>
            <p className="mt-3 text-xs">Phase {item.phase} · {item.oauth ? "OAuth" : "Server key / webhook"} · Last sync {item.lastSync ?? "never"}</p>
            {item.lastError ? <p className="text-xs text-danger">{item.lastError}</p> : null}
            {item.quickLink ? (
              <Button href={item.quickLink} variant="secondary" className="mt-4" size="sm">Open secure quick link</Button>
            ) : (
              <Button href="/dashboard/settings" variant="secondary" className="mt-4" size="sm">Configure env vars</Button>
            )}
            <p className="mt-2 text-xs text-muted">Disconnect / revoke will be available after a real connection is established.</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

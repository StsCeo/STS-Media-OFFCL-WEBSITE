import { RevenuePageClient } from "@/components/dashboard/revenue-table";
import { Card } from "@/components/ui";
import { loadVisibleOpsRecords } from "@/lib/org/operations-context";
import { formatCurrency } from "@/lib/utils";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Revenue" };

export default async function RevenuePage() {
  const { revenue, clients, source, unavailable, estimateNote } = await loadVisibleOpsRecords();
  const workspace = getWorkspace();
  return (
    <div>
      {unavailable ? (
        <Card className="mb-4">
          <p className="text-sm text-muted">Revenue could not be loaded from the database. Nothing was written to a local fallback.</p>
        </Card>
      ) : null}
      {source === "postgres" ? <p className="mb-4 text-xs text-muted">{estimateNote}</p> : null}
      <RevenuePageClient
        rows={revenue}
        clients={clients.map((c) => ({ id: c.id, businessName: c.businessName }))}
      />
      {source === "demo-memory" ? (
        <Card className="mt-4">
          <h2 className="font-semibold">Subscriptions</h2>
          <ul className="mt-3 text-sm">
            {workspace.subscriptions.map((item) => (
              <li key={item.id}>
                {item.name} · {formatCurrency(item.monthlyAmount)} / mo · {item.status}
                {item.status !== "active" ? " (excluded from MRR)" : ""}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

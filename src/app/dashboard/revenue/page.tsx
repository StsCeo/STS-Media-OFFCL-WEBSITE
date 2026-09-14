import { RevenuePageClient } from "@/components/dashboard/revenue-table";
import { Card } from "@/components/ui";
import { getWorkspace } from "@/lib/data/store";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Revenue" };

export default function RevenuePage() {
  const workspace = getWorkspace();
  return (
    <div>
      <RevenuePageClient
        rows={workspace.revenue}
        clients={workspace.clients.map((c) => ({ id: c.id, businessName: c.businessName }))}
      />
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
    </div>
  );
}

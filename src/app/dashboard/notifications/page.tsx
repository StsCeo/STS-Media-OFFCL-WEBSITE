import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Notifications" };

export default function NotificationsPage() {
  const items = getWorkspace().notifications;
  return (
    <div>
      <PageHeader title="Notifications" description="In-app alerts generated from workspace records, not invented news." />
      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">{item.title}</h2>
                <p className="text-sm text-muted">{item.body}</p>
              </div>
              <Badge tone={item.kind === "warning" ? "warning" : "info"}>{item.kind}</Badge>
            </div>
            <Link href={item.href} className="mt-2 inline-block text-sm text-forest">Open</Link>
          </Card>
        ))}
      </div>
    </div>
  );
}

import Link from "next/link";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard/leads", label: "Pipeline", match: ["/dashboard/leads"] },
  { href: "/dashboard/clients", label: "Clients", match: ["/dashboard/clients"] },
  { href: "/dashboard/crm/icps", label: "ICPs", match: ["/dashboard/crm/icps"] },
  { href: "/dashboard/crm/analytics", label: "Analytics", match: ["/dashboard/crm/analytics"] },
];

export function CrmSubnav({ current }: { current: string }) {
  return (
    <nav className="mb-6 flex flex-wrap gap-2" aria-label="CRM sections">
      {items.map((item) => {
        const active = item.match.some((path) => current === path || current.startsWith(`${path}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm",
              active ? "border-line bg-card font-medium text-ink" : "border-transparent text-muted hover:border-line hover:text-ink",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

import Link from "next/link";
import { createQuickRecord } from "@/app/actions";
import { Button, Card } from "@/components/ui";

const actions = [
  { kind: "lead", label: "Add lead", href: "/dashboard/leads" },
  { kind: "client", label: "Add client", href: "/dashboard/clients" },
  { kind: "project", label: "Add project", href: "/dashboard/projects" },
  { kind: "task", label: "Add task", href: "/dashboard/tasks" },
  { kind: "note", label: "Add note", href: "/dashboard/notes" },
] as const;

export function QuickActions() {
  return (
    <Card>
      <h2 className="text-lg font-semibold">Quick actions</h2>
      <p className="mt-1 text-sm text-muted">Create a draft record, then finish the details on its page.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {actions.map((item) => (
          <form key={item.kind} action={createQuickRecord}>
            <input type="hidden" name="kind" value={item.kind} />
            <Button type="submit" size="sm" variant="secondary">
              {item.label}
            </Button>
          </form>
        ))}
        <Button size="sm" href="/dashboard/revenue">
          Record income
        </Button>
        <Button size="sm" href="/dashboard/expenses">
          Record expense
        </Button>
        <Button size="sm" href="/dashboard/documents">
          Add document
        </Button>
        <Button size="sm" href="/dashboard/transactions">
          Master log
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted">
        Invoice drafts stay on <Link href="/dashboard/revenue" className="underline">Income</Link>. Payments are not marked collected until status is paid.
      </p>
    </Card>
  );
}

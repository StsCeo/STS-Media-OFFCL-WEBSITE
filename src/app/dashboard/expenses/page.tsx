import { ExpenseLedger } from "@/components/dashboard/expense-ledger";
import { Badge, Card, PageHeader } from "@/components/ui";
import { getWorkspace } from "@/lib/data/store";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Expenses" };

export default function ExpensesPage() {
  const workspace = getWorkspace();
  const live = workspace.expenses.filter((item) => !item.archived);
  const annualDrafts = live.filter((item) => item.billingFrequency === "yearly" && item.confirmationStatus === "draft");
  const baseline = annualDrafts.reduce((sum, item) => sum + item.totalAmount, 0);
  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title="Expense ledger"
        description="Inline-ready ledger with validation, filters, saved views, and audit history. Seeded annual costs are drafts until you confirm them."
      />
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase text-muted">Records</p>
          <p className="font-mono text-2xl">{live.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted">Draft annual baseline (editable)</p>
          <p className="font-mono text-2xl">{formatCurrency(baseline)}</p>
          <p className="mt-1 text-xs text-muted">Sum of draft yearly records, currently expected near $300.05 if starter amounts are unchanged.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted">Missing receipts</p>
          <p className="font-mono text-2xl">{live.filter((i) => i.receiptStatus === "missing").length}</p>
        </Card>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {annualDrafts.map((item) => (
          <Badge key={item.id} tone="warning">{item.description}: {formatCurrency(item.totalAmount)}</Badge>
        ))}
      </div>
      <ExpenseLedger expenses={workspace.expenses} />
      <Card className="mt-6">
        <h2 className="font-semibold">Recurring templates</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {workspace.recurringExpenses.map((item) => (
            <li key={item.id}>{item.description} · {formatCurrency(item.amount)} · next {item.nextDue}</li>
          ))}
        </ul>
      </Card>
      <Card className="mt-4">
        <h2 className="font-semibold">Audit history</h2>
        <ul className="mt-3 space-y-1 text-xs text-muted">
          {workspace.auditLog.slice(0, 8).map((item) => (
            <li key={item.id}>{item.at} · {item.actor} · {item.action} · {item.detail}</li>
          ))}
        </ul>
      </Card>
      <p className="mt-4 text-xs text-muted">Accountant/view-only access and expiring share links are scaffolded for Phase 2. CSV and print-ready PDF work now.</p>
    </div>
  );
}

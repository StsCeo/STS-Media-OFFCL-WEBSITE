import { ExpenseLedger } from "@/components/dashboard/expense-ledger";
import { Badge, Card, PageHeader } from "@/components/ui";
import { parseExpenseLedgerView } from "@/lib/expenses";
import { loadVisibleOpsRecords } from "@/lib/org/operations-context";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const params = await searchParams;
  const initialView = parseExpenseLedgerView(params.view);
  const { expenses, source, unavailable, estimateNote } = await loadVisibleOpsRecords();
  const live = expenses.filter((item) => !item.archived);
  const annualDrafts = live.filter((item) => item.billingFrequency === "yearly" && item.confirmationStatus === "draft");
  const baseline = annualDrafts.reduce((sum, item) => sum + item.totalAmount, 0);
  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title="Expense ledger"
        description="Inline-ready ledger with validation, filters, saved views, and audit history. Seeded annual costs are drafts until you confirm them."
      />
      {unavailable ? (
        <Card className="mb-4">
          <p className="text-sm text-muted">Expenses could not be loaded from the database. Nothing was written to a local fallback.</p>
        </Card>
      ) : null}
      {source === "postgres" ? <p className="mb-4 text-xs text-muted">{estimateNote}</p> : null}
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase text-muted">Records</p>
          <p className="font-mono text-2xl">{live.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted">Draft annual baseline (editable)</p>
          <p className="font-mono text-2xl">{formatCurrency(baseline)}</p>
          <p className="mt-1 text-xs text-muted">Sum of draft yearly records still stored as drafts.</p>
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
      <ExpenseLedger key={initialView} expenses={expenses} initialView={initialView} />
    </div>
  );
}

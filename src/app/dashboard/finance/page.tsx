import { Card, PageHeader } from "@/components/ui";
import { FINANCE_DEFINITIONS, computeFinanceFromLedgers, rangeFromPreset } from "@/lib/finance";
import { loadVisibleOpsRecords } from "@/lib/org/operations-context";
import { formatCurrency } from "@/lib/utils";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Finance" };

export default async function FinancePage() {
  const { expenses, revenue, source, unavailable, totals, estimateNote } = await loadVisibleOpsRecords();
  const workspace = getWorkspace();
  const metrics = computeFinanceFromLedgers(
    expenses,
    revenue,
    source === "postgres" ? [] : workspace.invoices,
    source === "postgres" ? [] : workspace.subscriptions,
    rangeFromPreset("year"),
  );
  return (
    <div>
      <PageHeader title="Finance" description="Definitions stay consistent across Overview, Expenses, and Revenue. Totals are operational estimates." />
      {unavailable ? (
        <Card className="mb-4">
          <p className="text-sm text-muted">Finance records could not be loaded from the database.</p>
        </Card>
      ) : null}
      <p className="mb-4 text-xs text-muted">{estimateNote}</p>
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Card className="p-4"><p className="text-xs uppercase text-muted">Total revenue</p><p className="font-mono text-2xl">{formatCurrency(totals.totalRevenue)}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase text-muted">Total expenses</p><p className="font-mono text-2xl">{formatCurrency(totals.totalExpenses)}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase text-muted">Net income</p><p className="font-mono text-2xl">{formatCurrency(totals.netIncome)}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase text-muted">Outstanding</p><p className="font-mono text-2xl">{formatCurrency(totals.outstandingRevenue)}</p></Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries({
          "Gross revenue": [metrics.grossRevenue, FINANCE_DEFINITIONS.grossRevenue],
          MRR: [metrics.mrr, FINANCE_DEFINITIONS.mrr],
          ARR: [metrics.arr, FINANCE_DEFINITIONS.arr],
          "Gross profit": [metrics.grossProfit, FINANCE_DEFINITIONS.grossProfit],
          "Net profit": [metrics.netProfit, FINANCE_DEFINITIONS.netProfit],
          "Cash collected": [metrics.cashCollected, FINANCE_DEFINITIONS.cashCollected],
          "Outstanding invoices": [metrics.outstandingInvoices, FINANCE_DEFINITIONS.outstandingInvoices],
          "Cash flow": [metrics.cashFlow, FINANCE_DEFINITIONS.cashVsAccrual],
        }).map(([label, [value, hint]]) => (
          <Card key={label}>
            <p className="text-xs uppercase text-muted">{label}</p>
            <p className="mt-2 font-mono text-2xl">{formatCurrency(Number(value))}</p>
            <p className="mt-2 text-sm text-muted">{String(hint)}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

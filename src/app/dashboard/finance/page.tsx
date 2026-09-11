import { Card, PageHeader } from "@/components/ui";
import { FINANCE_DEFINITIONS, computeFinance, rangeFromPreset } from "@/lib/finance";
import { getWorkspace } from "@/lib/data/store";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Finance" };

export default function FinancePage() {
  const metrics = computeFinance(getWorkspace(), rangeFromPreset("year"));
  return (
    <div>
      <PageHeader title="Finance" description="Definitions stay consistent across Overview, Expenses, and Revenue." />
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

import { Button, Card, PageHeader } from "@/components/ui";
import { getWorkspace } from "@/lib/data/store";
import { computeFinance, rangeFromPreset } from "@/lib/finance";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Reports" };

export default function ReportsPage() {
  const workspace = getWorkspace();
  const year = computeFinance(workspace, rangeFromPreset("year"));
  return (
    <div>
      <PageHeader title="Reports" description="Secure CSV and print-ready PDF from live workspace filters. Expiring share links are Phase 2." />
      <Card>
        <h2 className="font-semibold">Year snapshot</h2>
        <p className="mt-2 font-mono">Revenue {formatCurrency(year.grossRevenue)} · Expenses {formatCurrency(year.totalExpenses)} · Cash {formatCurrency(year.cashCollected)}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button href="/dashboard/expenses">Expense CSV / PDF</Button>
          <Button href="/dashboard/revenue" variant="secondary">Revenue ledger</Button>
        </div>
        <p className="mt-3 text-sm text-muted">Emailing a selected report uses the owner mailbox after Google Workspace is connected. Until then, download locally.</p>
      </Card>
    </div>
  );
}

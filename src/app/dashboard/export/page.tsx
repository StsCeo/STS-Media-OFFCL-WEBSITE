import { Button, Card, PageHeader } from "@/components/ui";
import { TAX_DISCLAIMER } from "@/lib/tax";

export const metadata = { title: "Export" };

export default function ExportPage() {
  return (
    <div>
      <PageHeader title="Backup and export" description="Download an owner-only JSON backup of operating records. This is not a filed tax return." />
      <Card>
        <h2 className="font-semibold">Full-data export</h2>
        <p className="mt-2 text-sm">{TAX_DISCLAIMER}</p>
        <p className="mt-2 text-sm text-muted">Passwords, session tokens, and an EIN are not included. Expense CSV and print remain available on the expense ledger as a fallback.</p>
        <Button className="mt-4" href="/dashboard/export/backup">
          Download JSON backup
        </Button>
      </Card>
    </div>
  );
}

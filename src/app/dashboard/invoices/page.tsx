import { InvoiceForm } from "@/components/dashboard/invoice-form";
import { Badge, Card, PageHeader } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { formatCurrency } from "@/lib/utils";
import { derivedInvoiceStatus, INVOICE_RECORD_NOTE } from "@/lib/org/workspace";
import { loadVisibleWorkspaceRecords } from "@/lib/org/workspace-context";

export const metadata = { title: "Invoices & Payments" };

function statusTone(status: string): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "paid") return "success";
  if (status === "issued") return "info";
  if (status === "overdue") return "danger";
  if (status === "void") return "warning";
  return "neutral";
}

export default async function InvoicesPage() {
  const { invoices, clients, source, unavailable, summaries } = await loadVisibleWorkspaceRecords();
  return (
    <div>
      <PageHeader
        title="Invoices & Payments"
        description="Operational invoice drafts, issued records, and manually recorded payments. This is not a payment processor, tax report, or accounting system."
      />
      {unavailable ? (
        <Card className="mb-4">
          <p className="text-sm text-muted">Invoices could not be loaded from the database. Nothing was written to a local fallback.</p>
        </Card>
      ) : null}
      <p className="mb-4 text-xs text-muted">{INVOICE_RECORD_NOTE}</p>
      {source === "postgres" ? <p className="mb-4 text-xs text-muted">Totals are calculated on the server in integer cents. Browser-submitted totals are ignored.</p> : null}
      <div className="mb-6 grid gap-3 md:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase text-muted">Draft invoices</p>
          <p className="font-mono text-2xl">{summaries.draftInvoices}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted">Outstanding recorded</p>
          <p className="font-mono text-2xl">{formatCurrency(summaries.outstandingInvoiceTotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted">Overdue recorded</p>
          <p className="font-mono text-2xl">{formatCurrency(summaries.overdueInvoiceTotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted">Paid recorded</p>
          <p className="font-mono text-2xl">{formatCurrency(summaries.paidInvoiceTotal)}</p>
        </Card>
      </div>
      <Card id="add" className="mb-6">
        <h2 className="mb-4 font-semibold">Create draft</h2>
        <InvoiceForm clients={clients} />
      </Card>
      <div className="grid gap-4">
        {invoices.map((invoice) => {
          const status = derivedInvoiceStatus(invoice);
          return (
            <Card key={invoice.id}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{invoice.invoiceNumber}</p>
                  <p className="text-sm">{invoice.clientBusinessName || "Client assigned on issue"}</p>
                  {invoice.sourceEstimateNumber ? <p className="text-xs text-muted">From estimate {invoice.sourceEstimateNumber}</p> : null}
                  <p className="mt-1 font-mono text-lg">{formatCents(invoice.totalCents, invoice.currency)}</p>
                </div>
                <Badge tone={statusTone(status)}>{status}</Badge>
              </div>
              <InvoiceForm invoice={invoice} clients={clients} />
            </Card>
          );
        })}
      </div>
    </div>
  );
}

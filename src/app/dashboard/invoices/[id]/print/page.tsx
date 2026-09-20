import { notFound } from "next/navigation";
import { Badge, Card, PageHeader } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { derivedInvoiceStatus, INVOICE_RECORD_NOTE } from "@/lib/org/workspace";
import { loadVisibleWorkspaceRecords } from "@/lib/org/workspace-context";

export const metadata = { title: "Invoice print view" };

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { invoices, unavailable } = await loadVisibleWorkspaceRecords();
  const invoice = invoices.find((item) => item.id === id);
  if (!invoice) notFound();
  const status = derivedInvoiceStatus(invoice);
  return (
    <div className="mx-auto max-w-3xl print:max-w-none">
      <PageHeader
        eyebrow="Scars to Stars Media"
        title={invoice.orgDisplayName || "STS Media"}
        description="Print-friendly operational invoice. PDF generation is a later feature. This is not a tax form or payment receipt from a processor."
      />
      {unavailable ? <p className="mb-4 text-sm text-muted">This record could not be confirmed from the database.</p> : null}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase text-muted">Invoice</p>
            <p className="font-mono text-xl">{invoice.invoiceNumber}</p>
            <Badge tone="info">{status}</Badge>
          </div>
          <div className="text-sm">
            <p>{invoice.orgLegalName}</p>
            <p>Issue {invoice.issueDate || "—"}</p>
            <p>Due {invoice.dueDate || "—"}</p>
          </div>
        </div>
        <div className="mt-6 text-sm">
          <p className="text-xs uppercase text-muted">Bill to</p>
          <p className="font-medium">{invoice.clientBusinessName || "Client"}</p>
          <p>{invoice.clientContactName}</p>
          <p>{invoice.clientEmail}</p>
        </div>
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="py-2">Description</th>
              <th className="py-2">Qty</th>
              <th className="py-2">Unit</th>
              <th className="py-2">Line</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, index) => (
              <tr key={line.id || index} className="border-b border-line">
                <td className="py-2">{line.description}</td>
                <td className="py-2">{line.quantity}</td>
                <td className="py-2">{formatCents(line.unitCents, invoice.currency)}</td>
                <td className="py-2">{formatCents(line.lineTotalCents, invoice.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-6 grid gap-2 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd className="font-mono">{formatCents(invoice.subtotalCents, invoice.currency)}</dd></div>
          <div className="flex justify-between"><dt>Discount</dt><dd className="font-mono">{formatCents(invoice.discountCents, invoice.currency)}</dd></div>
          <div className="flex justify-between"><dt>Tax</dt><dd className="font-mono">{formatCents(invoice.taxCents, invoice.currency)}</dd></div>
          <div className="flex justify-between font-semibold"><dt>Total</dt><dd className="font-mono">{formatCents(invoice.totalCents, invoice.currency)}</dd></div>
          <div className="flex justify-between"><dt>Amount recorded paid</dt><dd className="font-mono">{formatCents(invoice.amountPaidCents, invoice.currency)}</dd></div>
        </dl>
        {invoice.paymentInstructions ? <p className="mt-6 whitespace-pre-wrap text-sm">{invoice.paymentInstructions}</p> : null}
        {invoice.notes ? <p className="mt-4 whitespace-pre-wrap text-sm text-muted">{invoice.notes}</p> : null}
        <p className="mt-6 text-xs text-muted">{INVOICE_RECORD_NOTE}</p>
      </Card>
    </div>
  );
}

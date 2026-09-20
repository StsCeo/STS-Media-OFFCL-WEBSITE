import { notFound } from "next/navigation";
import { CommercialDocument } from "@/components/dashboard/commercial-document";
import { PrintToolbar } from "@/components/dashboard/print-toolbar";
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
      <PrintToolbar backHref="/dashboard/invoices" backLabel="Back to invoices" />
      {unavailable ? <p className="no-print mb-4 text-sm text-muted">This record could not be confirmed from the database.</p> : null}
      <CommercialDocument
        kind="Invoice"
        number={invoice.invoiceNumber}
        status={status}
        orgLegalName={invoice.orgLegalName}
        orgDisplayName={invoice.orgDisplayName}
        clientBusinessName={invoice.clientBusinessName}
        clientContactName={invoice.clientContactName}
        clientEmail={invoice.clientEmail}
        issueDate={invoice.issueDate}
        secondaryDateLabel="Due"
        secondaryDate={invoice.dueDate}
        currency={invoice.currency}
        lines={invoice.lines}
        subtotalCents={invoice.subtotalCents}
        discountCents={invoice.discountCents}
        taxCents={invoice.taxCents}
        totalCents={invoice.totalCents}
        amountPaidCents={invoice.amountPaidCents}
        customerNotes={invoice.notes}
        terms={invoice.paymentInstructions}
        sourceEstimateNumber={invoice.sourceEstimateNumber || undefined}
      />
      <p className="no-print mt-6 text-xs text-muted">{INVOICE_RECORD_NOTE}</p>
    </div>
  );
}

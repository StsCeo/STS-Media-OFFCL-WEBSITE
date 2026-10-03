import { notFound } from "next/navigation";
import { ClientInvoiceDocument } from "@/components/client/invoice-document";
import { PrintToolbar } from "@/components/dashboard/print-toolbar";
import { loadClientPortalInvoice } from "@/lib/org/client-portal";

export const metadata = { title: "Invoice" };
export const dynamic = "force-dynamic";

export default async function ClientInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadClientPortalInvoice(id);
  if (!data.invoice) notFound();
  const invoice = data.invoice;
  return (
    <div className="mx-auto max-w-4xl">
      <PrintToolbar backHref="/client#invoices" backLabel="Back to portal" />
      <ClientInvoiceDocument
        kind="Invoice"
        number={invoice.invoiceNumber}
        status={invoice.status}
        orgLegalName={invoice.orgLegalName}
        orgDisplayName={invoice.orgDisplayName}
        clientBusinessName={invoice.clientBusinessName}
        clientContactName={invoice.clientContactName}
        issueDate={invoice.issueDate}
        secondaryDateLabel="Due date"
        secondaryDate={invoice.dueDate}
        currency={invoice.currency}
        lines={invoice.lines}
        subtotalCents={invoice.subtotalCents}
        discountCents={invoice.discountCents}
        taxCents={invoice.taxCents}
        totalCents={invoice.totalCents}
      />
    </div>
  );
}

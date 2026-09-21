import { notFound } from "next/navigation";
import { ClientInvoiceDocument } from "@/components/client/invoice-document";
import { PrintToolbar } from "@/components/dashboard/print-toolbar";
import { loadClientPortalEstimate } from "@/lib/org/client-portal";

export const metadata = { title: "Estimate" };
export const dynamic = "force-dynamic";

export default async function ClientEstimatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadClientPortalEstimate(id);
  if (!data.estimate) notFound();
  const estimate = data.estimate;
  return (
    <div className="mx-auto max-w-4xl">
      <PrintToolbar backHref="/client#estimates" backLabel="Back to portal" />
      <ClientInvoiceDocument
        kind="Estimate"
        number={estimate.estimateNumber}
        status={estimate.status}
        orgLegalName={estimate.orgLegalName}
        orgDisplayName={estimate.orgDisplayName}
        clientBusinessName={estimate.clientBusinessName}
        clientContactName={estimate.clientContactName}
        issueDate={estimate.issueDate}
        secondaryDateLabel="Expires"
        secondaryDate={estimate.expiresOn}
        currency={estimate.currency}
        lines={estimate.lines}
        subtotalCents={estimate.subtotalCents}
        discountCents={estimate.discountCents}
        taxCents={estimate.taxCents}
        totalCents={estimate.totalCents}
        customerNotes={estimate.customerNotes}
        terms={estimate.terms}
        title={estimate.title}
        description={estimate.description}
      />
    </div>
  );
}

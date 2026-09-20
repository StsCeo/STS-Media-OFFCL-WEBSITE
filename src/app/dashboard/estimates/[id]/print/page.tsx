import { notFound } from "next/navigation";
import { CommercialDocument } from "@/components/dashboard/commercial-document";
import { PrintToolbar } from "@/components/dashboard/print-toolbar";
import { ESTIMATE_RECORD_NOTE, derivedEstimateStatus } from "@/lib/org/estimates";
import { loadVisibleEstimates } from "@/lib/org/estimates-context";

export const metadata = { title: "Estimate print view" };

export default async function EstimatePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { estimates, unavailable } = await loadVisibleEstimates();
  const estimate = estimates.find((item) => item.id === id);
  if (!estimate) notFound();
  const status = derivedEstimateStatus(estimate);
  return (
    <div className="mx-auto max-w-3xl print:max-w-none">
      <PrintToolbar backHref="/dashboard/estimates" backLabel="Back to estimates" />
      {unavailable ? <p className="no-print mb-4 text-sm text-muted">This record could not be confirmed from the database.</p> : null}
      <CommercialDocument
        kind="Estimate"
        number={estimate.estimateNumber}
        status={status}
        orgLegalName={estimate.orgLegalName}
        orgDisplayName={estimate.orgDisplayName}
        clientBusinessName={estimate.clientBusinessName}
        clientContactName={estimate.clientContactName}
        clientEmail={estimate.clientEmail}
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
        showDiscountColumn
      />
      {estimate.internalNotes ? (
        <p className="no-print mt-4 whitespace-pre-wrap text-sm text-muted">Internal notes: {estimate.internalNotes}</p>
      ) : null}
      <p className="no-print mt-6 text-xs text-muted">{ESTIMATE_RECORD_NOTE}</p>
    </div>
  );
}

import { EstimateForm } from "@/components/dashboard/estimate-form";
import { EstimatesBoard } from "@/components/dashboard/estimates-board";
import { Card, PageHeader } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import { loadClientPortalOwnerIndex, visibilityFor } from "@/lib/org/client-portal";
import { ESTIMATE_RECORD_NOTE } from "@/lib/org/estimates";
import { loadVisibleEstimates } from "@/lib/org/estimates-context";

export const metadata = { title: "Estimates & Quotes" };

export default async function EstimatesPage() {
  const [{ estimates, clients, convertedInvoiceIds, source, unavailable, summaries }, portal] = await Promise.all([
    loadVisibleEstimates(),
    loadClientPortalOwnerIndex(),
  ]);
  return (
    <div>
      <PageHeader
        title="Estimates & Quotes"
        description="Organization-scoped operational quotes. Ready records a lifecycle state only. An accepted, active quote can create one draft invoice. This page does not send email, store a PDF, collect signatures, or take payment."
      />
      {unavailable ? (
        <Card className="mb-4">
          <p className="text-sm text-muted" role="alert">Estimates could not be loaded from the database. Nothing was written to a local fallback.</p>
        </Card>
      ) : null}
      <p className="mb-4 text-xs text-muted">{ESTIMATE_RECORD_NOTE}</p>
      {source === "postgres" ? <p className="mb-4 text-xs text-muted">Totals are calculated on the server in integer cents. Browser-submitted totals are ignored.</p> : null}
      <div className="mb-6 grid gap-3 md:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase text-muted">Draft quotes</p>
          <p className="font-mono text-2xl">{summaries.draftEstimates}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted">Ready quotes</p>
          <p className="font-mono text-2xl">{summaries.readyEstimates}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted">Accepted recorded</p>
          <p className="font-mono text-2xl">{formatCurrency(summaries.acceptedEstimateTotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted">Expired display</p>
          <p className="font-mono text-2xl">{summaries.expiredEstimates}</p>
        </Card>
      </div>
      <Card id="add" className="mb-6">
        <h2 className="mb-4 font-semibold">Create draft</h2>
        <EstimateForm clients={clients} />
      </Card>
      <EstimatesBoard
        estimates={estimates}
        clients={clients}
        convertedInvoiceIds={convertedInvoiceIds}
        portalVisibility={Object.fromEntries(
          estimates.map((estimate) => [
            estimate.id,
            visibilityFor(
              portal,
              "estimate",
              estimate.id,
              estimate.clientId,
              estimate.clientBusinessName || clients.find((client) => client.id === estimate.clientId)?.businessName || "this client",
              Boolean(estimate.archived),
            ),
          ]),
        )}
      />
    </div>
  );
}

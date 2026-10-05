import { Card, EmptyState, PageHeader } from "@/components/ui";
import { CrmSubnav } from "@/components/dashboard/crm-subnav";
import { loadVisibleCrmRecords } from "@/lib/org/crm-context";
import { loadVisibleEstimates } from "@/lib/org/estimates-context";
import { computeSalesAnalytics } from "@/lib/org/crm-analytics";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Sales analytics" };

export default async function CrmAnalyticsPage() {
  const crm = await loadVisibleCrmRecords();
  const estimates = await loadVisibleEstimates();
  const analytics = computeSalesAnalytics(crm.leads, estimates.estimates);
  const metrics = [
    { label: "Total leads", value: String(analytics.totalLeads) },
    { label: "Qualified leads", value: String(analytics.qualifiedLeads) },
    { label: "Proposals / estimates sent", value: String(analytics.proposalsSent) },
    { label: "Deals won", value: String(analytics.dealsWon) },
    { label: "Deals lost", value: String(analytics.dealsLost) },
    { label: "Close rate", value: analytics.closeRate },
    { label: "Pipeline value", value: formatCurrency(analytics.pipelineValue) },
    { label: "Average deal value", value: typeof analytics.averageDealValue === "number" ? formatCurrency(analytics.averageDealValue) : analytics.averageDealValue },
    { label: "Lead → estimate", value: analytics.leadToEstimate },
    { label: "Estimate → client", value: analytics.estimateToClient },
  ];

  return (
    <div>
      <PageHeader title="Sales analytics" description="Thin CRM metrics from real leads and estimates. Rates stay blank until the denominator exists." />
      <CrmSubnav current="/dashboard/crm/analytics" />
      {crm.unavailable ? (
        <Card className="mb-4">
          <p className="text-sm text-muted">CRM records could not be loaded. Analytics were not filled from demo workspace numbers.</p>
        </Card>
      ) : null}
      {!analytics.hasActivity ? (
        <EmptyState title="No sales activity for this period." body="Add leads or send an estimate before expecting conversion rates." />
      ) : (
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {metrics.map((metric) => (
            <Card key={metric.label} className="p-4">
              <dt className="text-xs uppercase tracking-wide text-muted">{metric.label}</dt>
              <dd className="mt-2 font-mono text-xl">{metric.value}</dd>
            </Card>
          ))}
        </dl>
      )}
    </div>
  );
}

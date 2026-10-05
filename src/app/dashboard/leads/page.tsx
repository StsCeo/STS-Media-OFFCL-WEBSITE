import { Card, PageHeader } from "@/components/ui";
import { CrmSubnav } from "@/components/dashboard/crm-subnav";
import { LeadBoard } from "@/components/dashboard/lead-board";
import { loadVisibleCrmRecords } from "@/lib/org/crm-context";

export const metadata = { title: "Pipeline" };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    stage?: string;
    owner?: string;
    source?: string;
    service?: string;
    icp?: string;
    dateFrom?: string;
    dateTo?: string;
    valueMin?: string;
    valueMax?: string;
    lead?: string;
  }>;
}) {
  const filters = await searchParams;
  const { leads, icps, source, unavailable } = await loadVisibleCrmRecords();
  return (
    <div>
      <PageHeader title="Pipeline" description="Existing CRM stages, mapped to a sales board. Convert to client is explicit and does not run when a lead is marked Won." />
      <CrmSubnav current="/dashboard/leads" />
      {unavailable ? (
        <Card className="mb-4">
          <p className="text-sm text-muted">Leads could not be loaded from the database. Nothing was written to a local fallback.</p>
        </Card>
      ) : null}
      {source === "postgres" ? (
        <p className="mb-4 text-xs text-muted">These leads are stored on the organization record. In-memory demo leads are not mixed in.</p>
      ) : null}
      <LeadBoard leads={leads} icps={icps} filters={filters} />
    </div>
  );
}

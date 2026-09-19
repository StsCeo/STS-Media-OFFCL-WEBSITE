import { LeadBoard } from "@/components/dashboard/lead-board";
import { Card, PageHeader } from "@/components/ui";
import { loadVisibleCrmRecords } from "@/lib/org/crm-context";

export const metadata = { title: "Leads" };

export default async function LeadsPage() {
  const { leads, source, unavailable } = await loadVisibleCrmRecords();
  return (
    <div>
      <PageHeader title="Leads" description="Pipeline stages, follow-ups, and conversion. Demo leads are unlabeled companies until real contacts are added." />
      {unavailable ? (
        <Card className="mb-4">
          <p className="text-sm text-muted">Leads could not be loaded from the database. Nothing was written to a local fallback.</p>
        </Card>
      ) : null}
      {source === "postgres" ? (
        <p className="mb-4 text-xs text-muted">These leads are stored on the organization record. In-memory demo leads are not mixed in.</p>
      ) : null}
      <LeadBoard leads={leads} />
    </div>
  );
}

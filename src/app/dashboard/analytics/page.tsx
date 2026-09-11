import { Card, PageHeader } from "@/components/ui";
import { SimpleBarChart } from "@/components/dashboard/charts";
import { getWorkspace } from "@/lib/data/store";
import { LEAD_STAGES } from "@/lib/types";

export const metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  const workspace = getWorkspace();
  return (
    <div>
      <PageHeader title="Analytics" description="Business performance from workspace records. Website traffic stays empty until analytics is connected." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Lead stages</h2>
          <SimpleBarChart
            data={LEAD_STAGES.map((stage) => ({ label: stage.replaceAll("_", " "), value: workspace.leads.filter((l) => l.stage === stage).length }))}
            dataKey="value"
            name="Leads"
            color="var(--chart-leads)"
          />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Website traffic</h2>
          <p className="text-sm text-muted">No visits are fabricated. Connect website analytics in Integrations to populate this chart.</p>
        </Card>
      </div>
    </div>
  );
}

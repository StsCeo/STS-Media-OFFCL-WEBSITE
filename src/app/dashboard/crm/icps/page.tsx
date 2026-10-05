import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { CrmSubnav } from "@/components/dashboard/crm-subnav";
import { IcpEditor } from "@/components/dashboard/icp-editor";
import { loadVisibleCrmRecords } from "@/lib/org/crm-context";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "ICPs" };

export default async function IcpsPage() {
  const { icps, leads, source, unavailable } = await loadVisibleCrmRecords();
  return (
    <div>
      <PageHeader
        title="Ideal customer profiles"
        description="Define who you sell to, then associate leads so pipeline reporting can group by market."
      />
      <CrmSubnav current="/dashboard/crm/icps" />
      {unavailable ? (
        <Card className="mb-4">
          <p className="text-sm text-muted">ICPs could not be loaded from the database. Nothing was written to a local fallback.</p>
        </Card>
      ) : null}
      {source === "postgres" ? (
        <p className="mb-4 text-xs text-muted">These ICPs are stored on the organization record.</p>
      ) : null}
      <Card id="create" className="mb-6">
        <h2 className="mb-4 font-semibold">Create ICP</h2>
        <IcpEditor />
      </Card>
      {icps.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {icps.map((icp) => {
            const associated = leads.filter((lead) => lead.icpId === icp.id);
            return (
              <Card key={icp.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold">{icp.name}</h2>
                    <p className="text-sm text-muted">{icp.industry} · {icp.market || "No market"} · {icp.companySize || "Size unset"}</p>
                  </div>
                  <Badge>{icp.status}</Badge>
                </div>
                <p className="mt-3 text-sm">Budget {formatCurrency(icp.estimatedBudgetMin)} – {formatCurrency(icp.estimatedBudgetMax)}</p>
                <p className="mt-2 text-sm text-muted">{icp.commonProblems || "No common problems listed."}</p>
                <p className="mt-4 text-sm font-medium">Associated leads</p>
                {associated.length ? (
                  <ul className="mt-2 space-y-1 text-sm">
                    {associated.map((lead) => (
                      <li key={lead.id}>{lead.businessName} · {lead.stage.replaceAll("_", " ")}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted">No leads associated yet.</p>
                )}
                <div className="mt-4 border-t border-line pt-4">
                  <IcpEditor icp={icp} />
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No ICPs yet."
          body="Define your ideal customers so STS can measure which markets generate the strongest opportunities."
          action={<Button href="#create" size="sm">Create ICP</Button>}
        />
      )}
    </div>
  );
}

import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { DualLineChart, SimpleBarChart } from "@/components/dashboard/charts";
import { FINANCE_DEFINITIONS, computeFinance, expensesByCategory, rangeFromPreset, revenueByService, trendSeries } from "@/lib/finance";
import { briefing } from "@/lib/insights";
import { getWorkspace } from "@/lib/data/store";
import { formatCurrency } from "@/lib/utils";
import { LEAD_STAGES } from "@/lib/types";

export const metadata = { title: "Overview" };

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const params = await searchParams;
  const preset = (params.range as "today" | "7d" | "30d" | "quarter" | "year") || "30d";
  const workspace = getWorkspace();
  const range = rangeFromPreset(preset);
  const metrics = computeFinance(workspace, range);
  const trends = trendSeries(workspace);
  const today = briefing(workspace);
  const funnel = LEAD_STAGES.map((stage) => ({
    label: stage.replaceAll("_", " "),
    value: workspace.leads.filter((lead) => lead.stage === stage).length,
  }));
  const traffic = workspace.websiteTraffic.map((row) => ({ label: row.date.slice(5), value: row.visits }));
  const conversions = workspace.contacts.filter((item) => item.status === "new").length;

  const kpis = [
    ["Gross revenue", metrics.grossRevenue, FINANCE_DEFINITIONS.grossRevenue],
    ["MRR", metrics.mrr, FINANCE_DEFINITIONS.mrr],
    ["ARR", metrics.arr, FINANCE_DEFINITIONS.arr],
    ["Gross profit", metrics.grossProfit, FINANCE_DEFINITIONS.grossProfit],
    ["Net profit", metrics.netProfit, FINANCE_DEFINITIONS.netProfit],
    ["Total expenses", metrics.totalExpenses, "All recognized expenses in range."],
    ["Cash collected", metrics.cashCollected, FINANCE_DEFINITIONS.cashCollected],
    ["Outstanding invoices", metrics.outstandingInvoices, FINANCE_DEFINITIONS.outstandingInvoices],
    ["Active clients", workspace.clients.filter((c) => c.status === "active").length, "Clients marked active."],
    ["Active projects", workspace.projects.filter((p) => !["completed", "on_hold"].includes(p.stage)).length, "Projects not completed or on hold."],
    ["New leads", workspace.leads.filter((l) => l.stage === "new_inquiry").length, "Leads in New inquiry."],
    ["Booked calls", workspace.events.filter((e) => e.kind === "client_meeting").length, "Client meetings on the calendar."],
    ["Emails sent", workspace.emailsSentCount, "Logged send count. Inbox sync is Phase 2."],
    ["Calls made", workspace.callsMadeCount, "Logged call count."],
    ["Proposal conversion", workspace.leads.filter((l) => l.stage === "won").length && workspace.leads.filter((l) => ["proposal_sent", "negotiating", "won", "lost"].includes(l.stage)).length ? `${Math.round((workspace.leads.filter((l) => l.stage === "won").length / workspace.leads.filter((l) => ["proposal_sent", "negotiating", "won", "lost"].includes(l.stage)).length) * 100)}%` : "—", "Won / (proposal sent + negotiating + won + lost). Hidden when the set is empty."],
    ["Website traffic", workspace.websiteTraffic.reduce((sum, row) => sum + row.visits, 0) || "Needs analytics setup", "No fabricated traffic. Connect analytics in Phase 2."],
    ["Contact-form conversions", conversions, "New contact submissions in the workspace."],
  ] as const;

  return (
    <div>
      <PageHeader
        eyebrow="STS Media Command Center"
        title="Overview"
        description="Executive view of the business. Pending payments are not cash. One-time fees are not ARR."
        actions={
          <div className="flex flex-wrap gap-2 text-sm">
            {(["today", "7d", "30d", "quarter", "year"] as const).map((item) => (
              <Link key={item} href={`/dashboard?range=${item}`} className={`rounded-md border px-3 py-1 ${preset === item ? "border-forest bg-forest text-white" : "border-line"}`}>
                {item === "7d" ? "Last 7 days" : item === "30d" ? "Last 30 days" : item[0].toUpperCase() + item.slice(1)}
              </Link>
            ))}
            <Link href="/dashboard?range=custom" className="rounded-md border border-line px-3 py-1">
              Custom
            </Link>
          </div>
        }
      />

      <Card className="mb-6">
        <h2 className="text-lg font-semibold">Today at STS Media</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Brief title="Today’s meetings" items={today.meetingsToday.map((e) => e.title)} empty="No meetings on today’s calendar." />
          <Brief title="Top three priorities" items={today.priorities.map((t) => t.title)} empty="No open tasks." />
          <Brief title="Overdue tasks" items={today.overdue.map((t) => t.title)} empty="No overdue tasks." />
          <Brief title="Leads needing follow-up" items={today.followUps.map((l) => l.businessName)} href="/dashboard/leads" />
          <Brief title="Proposals awaiting response" items={today.proposals.map((l) => l.businessName)} href="/dashboard/leads" />
          <Brief title="Outstanding invoices" items={today.outstanding.map((i) => i.number)} href="/dashboard/revenue" />
          <Brief title="Recent payments" items={today.recentPayments.map((p) => p.description)} empty="No paid revenue yet." />
          <Brief title="Projects at risk" items={today.atRisk.map((p) => p.name)} href="/dashboard/projects" />
          <Brief title="Missing receipts" items={today.missingReceipts.map((e) => e.vendor)} href="/dashboard/expenses" />
          <Brief title="Upcoming recurring charges" items={today.upcomingCharges.map((e) => `${e.description} · ${e.nextDue}`)} />
          <Brief title="Expiring domains" items={today.expiringDomains.map((d) => `${d.domain} · ${d.expiresOn}`)} />
          <Brief title="Failed deployments" items={today.failedDeployments.map((d) => d.projectName)} empty="No failed deployments on file." />
          <Brief title="Content awaiting review" items={today.contentReview.map((c) => c.title)} href="/dashboard/content" />
        </div>
      </Card>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(([label, value, hint]) => (
          <Card key={label} className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-2 font-mono text-2xl">{typeof value === "number" ? formatCurrency(value) : value}</p>
            <p className="mt-2 text-xs text-muted">{hint}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">Revenue versus expenses</h2>
          <DualLineChart data={trends} aKey="revenue" bKey="expenses" aName="Revenue" bName="Expenses" />
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Profit trend</h2>
          <DualLineChart data={trends} aKey="profit" bKey="mrr" aName="Profit" bName="MRR (active subscriptions only)" />
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Revenue by service</h2>
          <SimpleBarChart
            data={revenueByService(workspace.revenue).map((row) => ({ label: row.service, value: row.total }))}
            dataKey="value"
            name="Revenue"
            color="var(--chart-revenue)"
          />
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Expenses by category</h2>
          <SimpleBarChart
            data={expensesByCategory(workspace.expenses).map((row) => ({ label: row.category, value: row.total }))}
            dataKey="value"
            name="Expenses"
            color="var(--chart-expenses)"
          />
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Sales funnel</h2>
          <SimpleBarChart data={funnel.map((row) => ({ label: row.label, value: row.value }))} dataKey="value" name="Leads" color="var(--chart-leads)" />
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Traffic and conversion</h2>
          {traffic.length ? (
            <SimpleBarChart data={traffic} dataKey="value" name="Visits" color="var(--chart-traffic)" />
          ) : (
            <p className="text-sm text-muted">Website analytics is not connected. Traffic is shown as empty rather than invented.</p>
          )}
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">MRR and ARR trend</h2>
          <DualLineChart data={trends} aKey="mrr" bKey="arr" aName="MRR" bName="ARR" />
          <p className="mt-2 text-xs text-muted">Draft subscriptions are excluded from MRR. State Collision Pro maintenance is draft until launch and first paid invoice.</p>
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Project status</h2>
          <ul className="space-y-2 text-sm">
            {workspace.projects.map((project) => (
              <li key={project.id} className="flex items-center justify-between gap-3">
                <Link href={`/dashboard/projects/${project.id}`} className="underline-offset-2 hover:underline">{project.name}</Link>
                <Badge tone={project.atRisk ? "warning" : "success"}>{project.stage.replaceAll("_", " ")}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Evidence-based recommendations</h2>
          <ul className="mt-4 space-y-3">
            {today.insights.map((insight) => (
              <li key={insight.id} className="rounded-md border border-line p-3">
                <p className="font-medium">{insight.title}</p>
                <p className="mt-1 text-sm text-muted">{insight.body}</p>
                <p className="mt-2 text-xs">Evidence: {insight.evidence}</p>
                <Link href={insight.href} className="mt-2 inline-block text-sm text-forest">Open</Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="font-semibold">Cash flow vs accounting profit</h2>
          <p className="mt-2 font-mono text-lg">Cash flow {formatCurrency(metrics.cashFlow)}</p>
          <p className="font-mono text-lg">Accounting profit {formatCurrency(metrics.accountingProfit)}</p>
          <p className="mt-3 text-sm text-muted">{FINANCE_DEFINITIONS.cashVsAccrual}</p>
        </Card>
      </div>
    </div>
  );
}

function Brief({ title, items, empty = "None", href }: { title: string; items: string[]; empty?: string; href?: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted">{title}</p>
      {items.length ? (
        <ul className="mt-1 list-disc pl-4 text-sm">
          {items.slice(0, 4).map((item) => (
            <li key={item}>{href ? <Link href={href}>{item}</Link> : item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted">{empty}</p>
      )}
    </div>
  );
}

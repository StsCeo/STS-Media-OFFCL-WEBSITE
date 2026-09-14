"use client";

import { useTransition } from "react";
import { upsertLead } from "@/app/actions";
import { Button, Card } from "@/components/ui";
import { LEAD_STAGES, type Lead } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const labels: Record<string, string> = {
  new_inquiry: "New inquiry",
  contacted: "Contacted",
  discovery_scheduled: "Discovery scheduled",
  discovery_completed: "Discovery completed",
  proposal_sent: "Proposal sent",
  negotiating: "Negotiating",
  won: "Won",
  lost: "Lost",
  nurture: "Nurture",
};

export function LeadBoard({ leads }: { leads: Lead[] }) {
  const [, start] = useTransition();
  const total = leads.length || 1;
  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-2 text-xs">
        {LEAD_STAGES.map((stage, index) => {
          const count = leads.filter((l) => l.stage === stage).length;
          const prev = index === 0 ? total : leads.filter((l) => LEAD_STAGES.indexOf(l.stage) <= index).length;
          return (
            <div key={stage} className="min-w-28 rounded-md border border-line p-2">
              <p>{labels[stage]}</p>
              <p className="font-mono text-lg">{count}</p>
              {index > 0 ? <p className="text-muted">{Math.round((count / total) * 100)}% of pipeline</p> : null}
              {index > 0 && prev === 0 ? null : null}
            </div>
          );
        })}
      </div>
      <p className="text-sm text-muted">Drop-off is visible where a stage is empty after earlier stages still hold leads.</p>
      <div className="grid gap-3 lg:grid-cols-3">
        {LEAD_STAGES.map((stage) => (
          <Card key={stage} className="p-3">
            <h2 className="text-sm font-semibold">{labels[stage]}</h2>
            <div className="mt-2 space-y-2">
              {leads.filter((l) => l.stage === stage).map((lead) => (
                <article key={lead.id} className="rounded-md border border-line p-3">
                  <p className="font-medium">{lead.businessName}</p>
                  <p className="text-xs text-muted">{lead.requestedService} · {lead.source}</p>
                  <p className="text-xs">Est. {formatCurrency(lead.estimatedValue)} · {lead.probability}%</p>
                  <p className="text-xs">Follow-up: {lead.nextFollowUp ?? "none"} · Last: {lead.lastContact ?? "none"}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {LEAD_STAGES.map((next) => (
                      <button key={next} className="rounded border border-line px-1 text-[10px]" onClick={() => start(() => upsertLead({ id: lead.id, stage: next }))}>
                        {labels[next]}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </Card>
        ))}
      </div>
      <Button onClick={() => start(() => upsertLead({ businessName: "New inquiry (draft)", notes: "Created from CRM" }))}>Add lead</Button>
    </div>
  );
}

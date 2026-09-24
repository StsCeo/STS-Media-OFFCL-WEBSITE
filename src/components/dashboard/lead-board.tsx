"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { convertLeadToClient, upsertLead } from "@/app/actions";
import { Button, Card, EmptyState, inputClass } from "@/components/ui";
import { PIPELINE_COLUMNS, STAGE_UI_LABELS, filterLeads, uniqueLeadValues } from "@/lib/org/crm-pipeline";
import type { IcpRecord, Lead, LeadStage } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type Filters = {
  stage?: string;
  owner?: string;
  source?: string;
  service?: string;
  icp?: string;
  dateFrom?: string;
  dateTo?: string;
  valueMin?: string;
  valueMax?: string;
};

export function LeadBoard({
  leads,
  icps,
  filters,
}: {
  leads: Lead[];
  icps: IcpRecord[];
  filters: Filters;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const icpName = useMemo(() => Object.fromEntries(icps.map((icp) => [icp.id, icp.name])), [icps]);
  const filtered = filterLeads(leads, {
    stage: filters.stage || null,
    owner: filters.owner || null,
    source: filters.source || null,
    service: filters.service || null,
    icp: filters.icp || null,
    dateFrom: filters.dateFrom || null,
    dateTo: filters.dateTo || null,
    valueMin: filters.valueMin ? Number(filters.valueMin) : null,
    valueMax: filters.valueMax ? Number(filters.valueMax) : null,
  });
  const owners = uniqueLeadValues(leads, "assignedTo");
  const sources = uniqueLeadValues(leads, "source");
  const services = uniqueLeadValues(leads, "requestedService");
  const activeStage = filters.stage || PIPELINE_COLUMNS[0].key;

  function setFilter(name: string, value: string) {
    const params = new URLSearchParams();
    const next = { ...filters, [name]: value };
    for (const [key, item] of Object.entries(next)) {
      if (item) params.set(key, item);
    }
    router.push(`/dashboard/leads${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <div className="space-y-4">
      <form className="grid gap-2 md:grid-cols-4 xl:grid-cols-8" onSubmit={(event) => event.preventDefault()}>
        <select className={inputClass} value={filters.stage || ""} onChange={(event) => setFilter("stage", event.target.value)} aria-label="Stage">
          <option value="">All stages</option>
          {PIPELINE_COLUMNS.map((column) => (
            <option key={column.key} value={column.key}>{column.label}</option>
          ))}
        </select>
        <select className={inputClass} value={filters.owner || ""} onChange={(event) => setFilter("owner", event.target.value)} aria-label="Owner">
          <option value="">All owners</option>
          {owners.map((owner) => (
            <option key={owner} value={owner}>{owner}</option>
          ))}
        </select>
        <select className={inputClass} value={filters.source || ""} onChange={(event) => setFilter("source", event.target.value)} aria-label="Source">
          <option value="">All sources</option>
          {sources.map((source) => (
            <option key={source} value={source}>{source}</option>
          ))}
        </select>
        <select className={inputClass} value={filters.service || ""} onChange={(event) => setFilter("service", event.target.value)} aria-label="Service">
          <option value="">All services</option>
          {services.map((service) => (
            <option key={service} value={service}>{service}</option>
          ))}
        </select>
        <select className={inputClass} value={filters.icp || ""} onChange={(event) => setFilter("icp", event.target.value)} aria-label="ICP">
          <option value="">All ICPs</option>
          {icps.filter((icp) => icp.status === "active").map((icp) => (
            <option key={icp.id} value={icp.id}>{icp.name}</option>
          ))}
        </select>
        <input type="date" className={inputClass} value={filters.dateFrom || ""} onChange={(event) => setFilter("dateFrom", event.target.value)} aria-label="From date" />
        <input type="date" className={inputClass} value={filters.dateTo || ""} onChange={(event) => setFilter("dateTo", event.target.value)} aria-label="To date" />
        <div className="grid grid-cols-2 gap-2">
          <input type="number" min="0" className={inputClass} value={filters.valueMin || ""} onChange={(event) => setFilter("valueMin", event.target.value)} placeholder="Min $" aria-label="Minimum deal value" />
          <input type="number" min="0" className={inputClass} value={filters.valueMax || ""} onChange={(event) => setFilter("valueMax", event.target.value)} placeholder="Max $" aria-label="Maximum deal value" />
        </div>
      </form>

      <div className="hidden gap-3 overflow-x-auto pb-2 lg:flex">
        {PIPELINE_COLUMNS.map((column) => {
          const columnLeads = filtered.filter((lead) => (column.stages as readonly string[]).includes(lead.stage));
          return (
            <Card key={column.key} className="min-w-64 flex-1 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">{column.label}</h2>
                <p className="font-mono text-sm">{columnLeads.length}</p>
              </div>
              <div className="space-y-2">
                {columnLeads.length ? columnLeads.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} icpName={lead.icpId ? icpName[lead.icpId] : undefined} icps={icps} start={start} />
                )) : (
                  <p className="text-xs text-muted">No leads in this stage.</p>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="lg:hidden">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {PIPELINE_COLUMNS.map((column) => {
            const count = filtered.filter((lead) => (column.stages as readonly string[]).includes(lead.stage)).length;
            return (
              <button
                key={column.key}
                type="button"
                className={`shrink-0 rounded-md border px-3 py-2 text-sm ${activeStage === column.key ? "border-line bg-card" : "border-line/60"}`}
                onClick={() => setFilter("stage", column.key)}
              >
                {column.label} <span className="font-mono">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {(filters.stage
            ? filtered.filter((lead) => {
                const column = PIPELINE_COLUMNS.find((item) => item.key === activeStage);
                return column ? (column.stages as readonly string[]).includes(lead.stage) : true;
              })
            : filtered
          ).map((lead) => (
            <LeadCard key={lead.id} lead={lead} icpName={lead.icpId ? icpName[lead.icpId] : undefined} icps={icps} start={start} />
          ))}
        </div>
      </div>

      {!leads.length ? (
        <EmptyState
          title="No leads yet"
          body="Capture inquiries here so the pipeline can show where the next client is coming from."
          action={<Button onClick={() => start(() => upsertLead({ businessName: "New inquiry (draft)", notes: "Created from CRM" }))}>Add Lead</Button>}
        />
      ) : !filtered.length ? (
        <EmptyState title="No matching leads" body="No sales activity matches these filters." />
      ) : (
        <Button onClick={() => start(() => upsertLead({ businessName: "New inquiry (draft)", notes: "Created from CRM" }))}>Add lead</Button>
      )}
    </div>
  );
}

function LeadCard({
  lead,
  icpName,
  icps,
  start,
}: {
  lead: Lead;
  icpName?: string;
  icps: IcpRecord[];
  start: (fn: () => void) => void;
}) {
  return (
    <article className="rounded-md border border-line p-3">
      <p className="font-medium">{lead.businessName}</p>
      <p className="text-xs text-muted">{lead.requestedService || "No service listed"} · {lead.source}</p>
      <p className="text-xs">Deal {formatCurrency(lead.estimatedValue)} · {lead.assignedTo}</p>
      <p className="text-xs">Follow-up: {lead.nextFollowUp ?? "none"}</p>
      {lead.expectedCloseOn ? <p className="text-xs">Close: {lead.expectedCloseOn}</p> : null}
      {icpName ? <p className="text-xs">ICP: {icpName}</p> : null}
      {lead.convertedClientId ? (
        <p className="mt-1 text-xs text-muted">Converted — original lead kept.</p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-1">
        {(Object.keys(STAGE_UI_LABELS) as LeadStage[]).map((stage) => (
          <button
            key={stage}
            type="button"
            className="rounded border border-line px-1 text-[10px]"
            onClick={() => start(() => upsertLead({ id: lead.id, stage }))}
          >
            {STAGE_UI_LABELS[stage]}
          </button>
        ))}
      </div>
      <label className="mt-2 block text-[11px] text-muted">
        Associate ICP
        <select
          className={`${inputClass} mt-1 h-8`}
          value={lead.icpId || ""}
          onChange={(event) => start(() => upsertLead({ id: lead.id, icpId: event.target.value || null }))}
        >
          <option value="">None</option>
          {icps.filter((icp) => icp.status === "active" || icp.id === lead.icpId).map((icp) => (
            <option key={icp.id} value={icp.id}>{icp.name}</option>
          ))}
        </select>
      </label>
      {!lead.convertedClientId ? (
        <Button
          size="sm"
          variant="secondary"
          className="mt-2"
          onClick={() => start(() => convertLeadToClient(lead.id))}
        >
          Convert to Client
        </Button>
      ) : (
        <Button size="sm" variant="ghost" className="mt-2" href={`/dashboard/clients/${lead.convertedClientId}`}>
          Open client
        </Button>
      )}
    </article>
  );
}

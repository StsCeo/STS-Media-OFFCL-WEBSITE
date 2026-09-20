"use client";

import { useMemo, useState } from "react";
import { EstimateForm } from "@/components/dashboard/estimate-form";
import { Badge, Card, EmptyState, Field, inputClass } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { derivedEstimateStatus, matchesEstimateSearch } from "@/lib/org/estimates-model";
import type { ClientRecord, WorkspaceEstimate, WorkspaceEstimateStatus } from "@/lib/types";

function statusTone(status: string): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "accepted") return "success";
  if (status === "ready") return "info";
  if (status === "expired" || status === "declined") return "warning";
  return "neutral";
}

const FILTERS: Array<{ id: string; label: string }> = [
  { id: "active", label: "Active" },
  { id: "draft", label: "Draft" },
  { id: "ready", label: "Ready" },
  { id: "accepted", label: "Accepted" },
  { id: "declined", label: "Declined" },
  { id: "expired", label: "Expired" },
  { id: "archived", label: "Archived" },
  { id: "all", label: "All" },
];

export function EstimatesBoard({
  estimates,
  clients,
  convertedInvoiceIds,
}: {
  estimates: WorkspaceEstimate[];
  clients: Pick<ClientRecord, "id" | "businessName">[];
  convertedInvoiceIds?: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("active");
  const visible = useMemo(() => {
    return estimates.filter((estimate) => {
      if (!matchesEstimateSearch(estimate, query)) return false;
      const derived = derivedEstimateStatus(estimate);
      if (filter === "all") return true;
      if (filter === "archived") return estimate.archived;
      if (filter === "active") return !estimate.archived;
      if (filter === "expired") return !estimate.archived && derived === "expired";
      return !estimate.archived && estimate.status === (filter as WorkspaceEstimateStatus);
    });
  }, [estimates, query, filter]);

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
        <Field label="Search estimates" name="estimateSearch">
          <input
            id="estimateSearch"
            className={inputClass}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search number, title, or customer"
          />
        </Field>
        <Field label="Status" name="estimateFilter">
          <select id="estimateFilter" className={inputClass} value={filter} onChange={(event) => setFilter(event.target.value)}>
            {FILTERS.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </Field>
      </div>
      {visible.length ? (
        visible.map((estimate) => {
          const status = derivedEstimateStatus(estimate);
          return (
            <Card key={estimate.id}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{estimate.estimateNumber}</p>
                  <p className="text-sm">{estimate.title}</p>
                  <p className="text-sm text-muted">{estimate.clientBusinessName || "No client assigned"}</p>
                  <p className="mt-1 font-mono text-lg">{formatCents(estimate.totalCents, estimate.currency)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={statusTone(status)}>{status}</Badge>
                  {estimate.archived ? <Badge tone="warning">archived</Badge> : null}
                </div>
              </div>
              <EstimateForm estimate={estimate} clients={clients} convertedInvoiceId={convertedInvoiceIds?.[estimate.id]} />
            </Card>
          );
        })
      ) : (
        <EmptyState
          title={estimates.length ? "No estimates match this search" : "No estimates yet"}
          body={estimates.length ? "Clear the search or choose another status." : "Create a draft quote. Ready does not send an email or store a PDF."}
        />
      )}
    </div>
  );
}

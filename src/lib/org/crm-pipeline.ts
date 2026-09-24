import type { Lead, LeadStage } from "@/lib/types";

export const PIPELINE_COLUMNS = [
  { key: "new_lead", label: "New Lead", stages: ["new_inquiry"] as const },
  { key: "contacted", label: "Contacted", stages: ["contacted"] as const },
  { key: "discovery", label: "Discovery", stages: ["discovery_scheduled", "discovery_completed"] as const },
  { key: "proposal", label: "Proposal", stages: ["proposal_sent"] as const },
  { key: "negotiation", label: "Negotiation", stages: ["negotiating"] as const },
  { key: "won", label: "Won", stages: ["won"] as const },
  { key: "lost", label: "Lost", stages: ["lost"] as const },
  { key: "nurture", label: "Nurture", stages: ["nurture"] as const },
] as const;

export type PipelineColumnKey = (typeof PIPELINE_COLUMNS)[number]["key"];

export const COMMAND_CENTER_PIPELINE_KEYS: PipelineColumnKey[] = [
  "new_lead",
  "contacted",
  "discovery",
  "proposal",
  "won",
];

export const STAGE_UI_LABELS: Record<LeadStage, string> = {
  new_inquiry: "New Lead",
  contacted: "Contacted",
  discovery_scheduled: "Discovery",
  discovery_completed: "Discovery",
  proposal_sent: "Proposal",
  negotiating: "Negotiation",
  won: "Won",
  lost: "Lost",
  nurture: "Nurture",
};

export function pipelineColumnForStage(stage: LeadStage): (typeof PIPELINE_COLUMNS)[number] {
  return PIPELINE_COLUMNS.find((column) => (column.stages as readonly string[]).includes(stage)) ?? PIPELINE_COLUMNS[0];
}

export function leadsInColumn(leads: Lead[], key: PipelineColumnKey) {
  const column = PIPELINE_COLUMNS.find((item) => item.key === key);
  if (!column) return [];
  return leads.filter((lead) => (column.stages as readonly string[]).includes(lead.stage));
}

export function pipelineCounts(leads: Lead[]) {
  return Object.fromEntries(
    PIPELINE_COLUMNS.map((column) => [column.key, leadsInColumn(leads, column.key).length]),
  ) as Record<PipelineColumnKey, number>;
}

export type LeadPipelineFilters = {
  stage?: string | null;
  owner?: string | null;
  source?: string | null;
  service?: string | null;
  icp?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  valueMin?: number | null;
  valueMax?: number | null;
};

export function filterLeads(leads: Lead[], filters: LeadPipelineFilters) {
  return leads.filter((lead) => {
    if (filters.stage) {
      const column = PIPELINE_COLUMNS.find((item) => item.key === filters.stage);
      const stageMatch = column
        ? (column.stages as readonly string[]).includes(lead.stage)
        : lead.stage === filters.stage;
      if (!stageMatch) return false;
    }
    if (filters.owner && lead.assignedTo !== filters.owner) return false;
    if (filters.source && lead.source !== filters.source) return false;
    if (filters.service && lead.requestedService !== filters.service) return false;
    if (filters.icp && lead.icpId !== filters.icp) return false;
    const created = lead.createdAt.slice(0, 10);
    if (filters.dateFrom && created < filters.dateFrom) return false;
    if (filters.dateTo && created > filters.dateTo) return false;
    if (filters.valueMin != null && lead.estimatedValue < filters.valueMin) return false;
    if (filters.valueMax != null && lead.estimatedValue > filters.valueMax) return false;
    return true;
  });
}

export function uniqueLeadValues(leads: Lead[], key: "assignedTo" | "source" | "requestedService") {
  return Array.from(new Set(leads.map((lead) => lead[key]).filter(Boolean))).sort();
}

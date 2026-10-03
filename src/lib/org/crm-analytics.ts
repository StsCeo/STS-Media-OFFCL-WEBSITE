import type { Lead, WorkspaceEstimate } from "@/lib/types";

const INSUFFICIENT = "Not enough data";

export type SalesAnalytics = {
  totalLeads: number;
  qualifiedLeads: number;
  proposalsSent: number;
  dealsWon: number;
  dealsLost: number;
  closeRate: string;
  pipelineValue: number;
  averageDealValue: string | number;
  leadToEstimate: string;
  estimateToClient: string;
  hasActivity: boolean;
};

const QUALIFIED_STAGES = new Set([
  "discovery_scheduled",
  "discovery_completed",
  "proposal_sent",
  "negotiating",
  "won",
]);

function rate(numerator: number, denominator: number) {
  if (denominator <= 0) return INSUFFICIENT;
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export function computeSalesAnalytics(leads: Lead[], estimates: WorkspaceEstimate[] = []): SalesAnalytics {
  const totalLeads = leads.length;
  const qualifiedLeads = leads.filter((lead) => QUALIFIED_STAGES.has(lead.stage)).length;
  const proposalsFromLeads = leads.filter(
    (lead) =>
      lead.stage === "proposal_sent" ||
      lead.stage === "negotiating" ||
      lead.stage === "won" ||
      lead.stage === "lost" ||
      Boolean(lead.estimateId),
  ).length;
  const estimatesSent = estimates.filter((item) => item.status !== "draft").length;
  const proposalsSent = Math.max(proposalsFromLeads, estimatesSent);
  const dealsWon = leads.filter((lead) => lead.stage === "won").length;
  const dealsLost = leads.filter((lead) => lead.stage === "lost").length;
  const decided = dealsWon + dealsLost;
  const openPipeline = leads.filter((lead) => lead.stage !== "won" && lead.stage !== "lost");
  const pipelineValue = openPipeline.reduce((sum, lead) => sum + lead.estimatedValue, 0);
  const wonValues = leads.filter((lead) => lead.stage === "won").map((lead) => lead.estimatedValue);
  const converted = leads.filter((lead) => Boolean(lead.convertedClientId)).length;
  const acceptedEstimates = estimates.filter((item) => item.status === "accepted").length;

  return {
    totalLeads,
    qualifiedLeads,
    proposalsSent,
    dealsWon,
    dealsLost,
    closeRate: rate(dealsWon, decided),
    pipelineValue,
    averageDealValue: wonValues.length ? Math.round(wonValues.reduce((sum, value) => sum + value, 0) / wonValues.length) : INSUFFICIENT,
    leadToEstimate: rate(proposalsSent, totalLeads),
    estimateToClient: rate(converted || acceptedEstimates, estimatesSent || proposalsFromLeads),
    hasActivity: totalLeads > 0 || estimates.length > 0,
  };
}

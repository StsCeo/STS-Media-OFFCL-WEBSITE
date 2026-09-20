import { defaultBusinessProfile } from "./business-defaults";
import { defaultTaxChecklist } from "../tax";
import { createSeedWorkspace } from "./seed";
import type { WorkspaceState, WorkspaceInvoice } from "../types";

type GlobalStore = typeof globalThis & {
  __stsWorkspace?: WorkspaceState;
};

function g() {
  return globalThis as GlobalStore;
}

function ensurePhase1(state: WorkspaceState): WorkspaceState {
  if (!state.businessProfile) state.businessProfile = defaultBusinessProfile();
  if (!Array.isArray(state.notes)) state.notes = [];
  if (!Array.isArray(state.osDocuments)) state.osDocuments = [];
  if (!Array.isArray(state.workspaceInvoices)) state.workspaceInvoices = [];
  for (const invoice of state.workspaceInvoices) {
    const row = invoice as WorkspaceInvoice & { sourceEstimateId?: string | null; sourceEstimateNumber?: string };
    if (row.sourceEstimateId === undefined) row.sourceEstimateId = null;
    if (row.sourceEstimateNumber === undefined) row.sourceEstimateNumber = "";
  }
  if (!Array.isArray(state.workspaceEstimates)) state.workspaceEstimates = [];
  if (!Array.isArray(state.osTransactions)) state.osTransactions = [];
  if (!Array.isArray(state.taxChecklist)) state.taxChecklist = defaultTaxChecklist(2026);
  if (!state.dashboardPreferences) state.dashboardPreferences = { hiddenCards: [], cardOrder: [] };
  return state;
}

export function getWorkspace(): WorkspaceState {
  if (!g().__stsWorkspace) {
    g().__stsWorkspace = createSeedWorkspace();
  }
  return ensurePhase1(g().__stsWorkspace!);
}

export function resetWorkspace() {
  g().__stsWorkspace = createSeedWorkspace();
  return g().__stsWorkspace!;
}

export function mutateWorkspace(recipe: (state: WorkspaceState) => void) {
  const state = getWorkspace();
  recipe(state);
  return state;
}

export function stampAudit(action: string, target: string, detail: string, actor = "owner") {
  const state = getWorkspace();
  state.auditLog.unshift({
    id: `audit-${Date.now()}`,
    at: new Date().toISOString(),
    actor,
    action,
    target,
    detail,
  });
}

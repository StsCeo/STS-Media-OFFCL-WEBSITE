import { createSeedWorkspace } from "./seed";
import type { WorkspaceState } from "../types";

type GlobalStore = typeof globalThis & {
  __stsWorkspace?: WorkspaceState;
};

function g() {
  return globalThis as GlobalStore;
}

export function getWorkspace(): WorkspaceState {
  if (!g().__stsWorkspace) {
    g().__stsWorkspace = createSeedWorkspace();
  }
  return g().__stsWorkspace!;
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

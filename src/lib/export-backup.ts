import { TAX_DISCLAIMER } from "./tax";
import type { WorkspaceState } from "./types";

export function buildWorkspaceBackup(workspace: WorkspaceState) {
  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    phase: 1,
    product: "STS Media Business OS",
    taxDisclaimer: TAX_DISCLAIMER,
    note: "Operational backup for recordkeeping. This is not a filed tax return and does not include passwords or secrets.",
    businessProfile: workspace.businessProfile,
    brand: workspace.brand,
    clients: workspace.clients,
    leads: workspace.leads,
    projects: workspace.projects,
    tasks: workspace.tasks,
    notes: workspace.notes,
    documents: workspace.osDocuments,
    expenses: workspace.expenses,
    recurringExpenses: workspace.recurringExpenses,
    revenue: workspace.revenue,
    invoices: workspace.invoices,
    subscriptions: workspace.subscriptions,
    osTransactions: workspace.osTransactions,
    files: workspace.files,
    taxChecklist: workspace.taxChecklist,
    dashboardPreferences: workspace.dashboardPreferences,
    auditLog: workspace.auditLog,
    contacts: workspace.contacts,
  };
}

export function backupFilename(exportedAt = new Date()) {
  const stamp = exportedAt.toISOString().slice(0, 10);
  return `sts-media-backup-${stamp}.json`;
}

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import {
  PROJECT_KICKOFF_RPC,
  SCHEDULE_RECONCILE_RPC,
  buildInternalSchedule,
  canStartProjectFromInvoice,
  derivedGeneratedCalendarEvents,
  draftProjectFromConvertedInvoice,
  filterSchedule,
  isValidScheduleDate,
  kickoffProjectIds,
  mergeCalendarEvents,
  scheduleBucket,
  scheduleSourceLabel,
} from "@/lib/org/schedule-model";
import type { Project, TaskItem, WorkspaceEstimate, WorkspaceInvoice } from "@/lib/types";

const estimate = {
  id: "est-1",
  estimateNumber: "EST-0001",
  status: "accepted",
  title: "Website rebuild",
  description: "Do not copy",
  clientId: "client-1",
  issueDate: "2026-09-01",
  expiresOn: "2026-09-25",
  currency: "USD",
  internalNotes: "secret notes",
  customerNotes: "customer facing",
  terms: "Net 15",
  orgLegalName: "Org",
  orgDisplayName: "Org",
  clientBusinessName: "Client",
  clientContactName: "Casey",
  clientEmail: "casey@example.test",
  subtotalCents: 10000,
  discountCents: 0,
  taxCents: 0,
  totalCents: 10000,
  lines: [],
  readyAt: null,
  acceptedAt: "2026-09-02",
  declinedAt: null,
  expiredAt: null,
  archived: false,
  createdAt: "2026-09-01",
  updatedAt: "2026-09-02",
} as WorkspaceEstimate;

const invoice = {
  id: "inv-1",
  invoiceNumber: "DRAFT-1",
  status: "draft",
  clientId: "client-1",
  issueDate: "2026-09-02",
  dueDate: "2026-09-10",
  currency: "USD",
  notes: "customer facing",
  paymentInstructions: "Net 15",
  orgLegalName: "Org",
  orgDisplayName: "Org",
  clientBusinessName: "Client",
  clientContactName: "Casey",
  clientEmail: "casey@example.test",
  subtotalCents: 10000,
  discountCents: 0,
  taxCents: 0,
  totalCents: 10000,
  amountPaidCents: 0,
  lines: [{ position: 1, description: "Website quote", quantity: 1, unitCents: 10000, lineTotalCents: 10000 }],
  sourceEstimateId: "est-1",
  sourceEstimateNumber: "EST-0001",
  issuedAt: null,
  paidAt: null,
  voidedAt: null,
  archived: false,
  createdAt: "2026-09-02",
  updatedAt: "2026-09-02",
} as WorkspaceInvoice;

const project = {
  id: "proj-1",
  name: "Launch site",
  clientId: "client-1",
  packageId: null,
  stage: "discovery",
  startDate: "2026-09-20",
  deadline: "2026-10-04",
  budget: 100,
  amountInvoiced: 0,
  amountCollected: 0,
  directCost: 0,
  githubRepo: "",
  vercelProject: "",
  productionUrl: "",
  domain: "",
  maintenancePlan: "",
  credentialsReference: "",
  notes: "internal",
  atRisk: false,
} as Project;

const task = {
  id: "task-1",
  title: "Write copy",
  projectId: "proj-1",
  clientId: "client-1",
  dueDate: "2026-09-18",
  status: "todo",
  priority: "high",
  assignee: "Owner",
  notes: "",
} as TaskItem;

describe("internal schedule helpers", () => {
  it("labels source types and buckets today, upcoming, and overdue", () => {
    expect(scheduleSourceLabel("invoice_due")).toBe("Invoice due");
    expect(scheduleBucket("2026-09-20", "2026-09-20")).toBe("today");
    expect(scheduleBucket("2026-09-21", "2026-09-20")).toBe("upcoming");
    expect(scheduleBucket("2026-09-19", "2026-09-20")).toBe("overdue");
    expect(isValidScheduleDate("1990-01-01")).toBe(false);
    expect(isValidScheduleDate("2026-09-20")).toBe(true);
  });

  it("builds a unified schedule without duplicating generated calendar rows", () => {
    const generated = derivedGeneratedCalendarEvents({
      projects: [project],
      tasks: [task],
      estimates: [estimate],
      invoices: [invoice],
    });
    expect(generated.some((event) => event.title.startsWith("Project start:"))).toBe(true);
    expect(generated.every((event) => event.generated && event.sourceId)).toBe(true);
    const merged = mergeCalendarEvents(
      [{ id: "ev-manual", title: "Planning", kind: "team_meeting", start: "2026-09-20T15:00:00.000Z", end: "2026-09-20T16:00:00.000Z", notes: "", relatedId: null, location: "", generated: false, sourceType: "manual", sourceId: null }],
      generated,
    );
    const schedule = buildInternalSchedule({
      projects: [project],
      tasks: [task],
      estimates: [estimate],
      invoices: [invoice],
      events: merged,
    });
    expect(filterSchedule(schedule, "overdue", "2026-09-20").some((item) => item.sourceType === "task_due")).toBe(true);
    expect(filterSchedule(schedule, "upcoming", "2026-09-20").some((item) => item.sourceType === "project_deadline")).toBe(true);
    expect(schedule.filter((item) => item.sourceType === "manual")).toHaveLength(1);
    expect(schedule.every((item) => !JSON.stringify(item).includes("customer facing"))).toBe(true);
  });

  it("starts at most one project from a converted invoice and copies only operational snapshot fields", () => {
    expect(canStartProjectFromInvoice(invoice, estimate, null)).toBe(true);
    expect(canStartProjectFromInvoice(invoice, { ...estimate, status: "ready" }, null)).toBe(false);
    expect(canStartProjectFromInvoice(invoice, estimate, "proj-existing")).toBe(false);
    const drafted = draftProjectFromConvertedInvoice(invoice, estimate, "2026-09-20");
    expect(drafted.sourceInvoiceId).toBe(invoice.id);
    expect(drafted.sourceEstimateId).toBe(estimate.id);
    expect(drafted.notes).toBe("");
    expect(drafted.name).toBe("Website rebuild");
    expect(drafted.deadline).toBe("2026-09-10");
    expect(kickoffProjectIds([drafted])).toEqual({ "inv-1": drafted.id });
  });
});

describe("day 7 migrations", () => {
  it("adds schedule columns, generated uniqueness, kickoff FKs, and sanitized RPCs", () => {
    const files = readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).sort();
    expect(files).toEqual(expect.arrayContaining([
      "20260920180000_day7_schedule_automations.sql",
      "20260920181000_day7_schedule_rpcs.sql",
    ]));
    const schema = readFileSync("supabase/migrations/20260920180000_day7_schedule_automations.sql", "utf8");
    const rpcs = readFileSync("supabase/migrations/20260920181000_day7_schedule_rpcs.sql", "utf8");
    expect(schema).toContain("source_type");
    expect(schema).toContain("generated");
    expect(schema).toContain("ws_calendar_source_uidx");
    expect(schema).toContain("source_invoice_id");
    expect(schema).toContain("sts_internal_schedule");
    expect(schema).toContain("security_invoker");
    expect(schema).toContain("sts_can_read_invoices");
    expect(rpcs).toContain(SCHEDULE_RECONCILE_RPC);
    expect(rpcs).toContain(PROJECT_KICKOFF_RPC);
    expect(rpcs).toContain("schedule.reconciled");
    expect(rpcs).toContain("project.started_from_invoice");
    expect(rpcs).toContain("schedule.entry_created");
    expect(rpcs).toContain("unique_violation");
    expect(rpcs).toContain("set search_path = public");
    expect(rpcs).not.toMatch(/grant execute[\s\S]{0,80}to anon/i);
    expect(rpcs).not.toMatch(/customer_notes[\s\S]{0,80}audit_events/);
    expect(rpcs).not.toMatch(/line.description[\s\S]{0,80}audit_events/);
    expect(readFileSync("src/app/dashboard/calendar/page.tsx", "utf8")).not.toContain("Calendar automations are planned");
    expect(readFileSync("vercel.json", "utf8")).toContain('"main": true');
    expect(readFileSync("vercel.json", "utf8")).toContain('"*": false');
  });
});

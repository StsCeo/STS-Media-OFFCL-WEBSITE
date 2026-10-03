import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submitContact } from "@/app/actions";
import { getWorkspace, resetWorkspace } from "@/lib/data/store";
import { deriveOperationalAgenda } from "@/lib/org/command-center";
import {
  applyLocalPublicIntake,
  captureConfiguredIntake,
  PUBLIC_INTAKE_FAILURE,
  PUBLIC_INTAKE_RPC,
  publicIntakeRpcArgs,
  type PublicIntakeInput,
} from "@/lib/org/public-intake";
import type { CalendarEvent, Lead, TaskItem } from "@/lib/types";

const KEY = "11111111-1111-4111-8111-111111111111";
const intakeSql = readFileSync("supabase/migrations/20261003010000_phase1_public_intake.sql", "utf8");

const intake: PublicIntakeInput = {
  submissionKey: KEY,
  contactName: "Ada Lovelace",
  businessName: "Analytical Engines",
  email: "ada@example.com",
  phone: "",
  service: "Website",
  audience: "owner",
  budget: "",
  preferredContact: "email",
  message: "Need a new marketing site for the shop.",
};

function memory() {
  return { leads: [] as Lead[], tasks: [] as TaskItem[] };
}

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  data.set("name", intake.contactName);
  data.set("businessName", intake.businessName);
  data.set("email", intake.email);
  data.set("phone", intake.phone);
  data.set("service", intake.service);
  data.set("budget", intake.budget);
  data.set("preferredContact", intake.preferredContact);
  data.set("message", intake.message);
  data.set("consent", "on");
  data.set("companyWebsite", "");
  data.set("submissionKey", KEY);
  for (const [name, value] of Object.entries(overrides)) data.set(name, value);
  return data;
}

const { forwardedFor, serviceRpc } = vi.hoisted(() => ({
  forwardedFor: { ip: "203.0.113.40" },
  serviceRpc: vi.fn<(name: string, args: Record<string, unknown>) => Promise<{ data: { ok: true }; error: null }>>(
    async () => ({ data: { ok: true }, error: null }),
  ),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    getAll: () => [],
    set: () => undefined,
    delete: () => undefined,
  }),
  headers: async () =>
    new Headers({
      origin: "http://localhost:3000",
      host: "localhost:3000",
      "x-forwarded-for": forwardedFor.ip,
    }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceRoleClient: () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
    return { rpc: serviceRpc };
  },
}));

describe("public intake records", () => {
  it("creates one lead and one follow-up, then ignores a replay", () => {
    const store = memory();
    expect(applyLocalPublicIntake(store, intake).created).toBe(true);
    expect(store.leads).toHaveLength(1);
    expect(store.tasks).toHaveLength(1);
    expect(store.leads[0]?.stage).toBe("new_inquiry");
    expect(store.leads[0]?.emailsSent).toBe(0);
    expect(store.tasks[0]?.title).toBe("Follow up: Analytical Engines");
    expect(store.tasks[0]?.status).toBe("todo");
    expect(applyLocalPublicIntake(store, intake).created).toBe(false);
    expect(store.leads).toHaveLength(1);
    expect(store.tasks).toHaveLength(1);
  });

  it("omits organization scope from the database arguments", () => {
    const args = publicIntakeRpcArgs({
      ...intake,
      organizationId: "00000000-0000-4000-8000-000000000099",
    } as PublicIntakeInput & { organizationId: string });
    expect(args.p_submission_key).toBe(KEY);
    expect(Object.keys(args).join(" ")).not.toMatch(/organization/i);
    expect(JSON.stringify(args)).not.toContain("00000000-0000-4000-8000-000000000099");
  });

  it("hides provider errors and returned record ids", async () => {
    const leaked = await captureConfiguredIntake(async () => ({ data: null, error: { message: "secret database detail" } }), intake);
    expect(leaked).toEqual({ ok: false, error: PUBLIC_INTAKE_FAILURE });
    expect(JSON.stringify(leaked)).not.toContain("secret");

    const rows = await captureConfiguredIntake(async () => ({
      data: { ok: true, lead_id: "lead-secret", task_id: "task-secret" },
      error: null,
    }), intake);
    expect(rows.ok).toBe(false);

    const calls: string[] = [];
    const saved = await captureConfiguredIntake(async (name, args) => {
      calls.push(name);
      expect(args).toEqual(publicIntakeRpcArgs(intake));
      return { data: { ok: true }, error: null };
    }, intake);
    expect(saved).toEqual({ ok: true });
    expect(calls).toEqual([PUBLIC_INTAKE_RPC]);
  });

  it("shows the task on Today without a second lead card", () => {
    const store = memory();
    applyLocalPublicIntake(store, intake, new Date("2026-10-02T16:00:00Z"));
    const items = deriveOperationalAgenda({
      tasks: store.tasks,
      leads: store.leads,
      invoices: [],
      projects: [],
      events: [],
      now: new Date("2026-10-02T16:00:00Z"),
    });
    expect(items.filter((item) => item.label.startsWith("Follow up:"))).toHaveLength(1);
    expect(items.some((item) => item.label.startsWith("Lead follow-up"))).toBe(false);
  });

  it("shows one follow-up and hides the task calendar mirror and lead card", () => {
    const store = memory();
    const staging = { ...intake, contactName: "Phase One Test", businessName: "STS Intake Test" };
    applyLocalPublicIntake(store, staging, new Date("2026-10-02T16:00:00Z"));
    const task = store.tasks[0]!;
    const mirror: CalendarEvent = {
      id: "generated-task-due",
      title: `Task due: ${task.title}`,
      kind: "task",
      start: "2026-10-02T00:00:00.000Z",
      end: "2026-10-02T23:59:59.000Z",
      notes: "",
      relatedId: task.id,
      location: "",
      allDay: true,
      timezone: "UTC",
      generated: true,
      sourceType: "task_due",
      sourceId: task.id,
    };
    const items = deriveOperationalAgenda({
      tasks: store.tasks,
      leads: store.leads,
      invoices: [],
      projects: [],
      events: [mirror],
      now: new Date("2026-10-02T16:00:00Z"),
    });
    expect(items.map((item) => item.label)).toEqual(["Follow up: STS Intake Test"]);
    expect(items[0]?.bucket).toBe("today");
  });

  it("keeps a calendar event that is not a task mirror", () => {
    const meeting: CalendarEvent = {
      id: "meeting-1",
      title: "Owner planning",
      kind: "team_meeting",
      start: "2026-10-02T15:00:00.000Z",
      end: "2026-10-02T15:30:00.000Z",
      notes: "",
      relatedId: null,
      location: "",
      sourceType: "manual",
      sourceId: null,
    };
    const items = deriveOperationalAgenda({
      tasks: [],
      leads: [],
      invoices: [],
      projects: [],
      events: [meeting],
      now: new Date("2026-10-02T16:00:00Z"),
    });
    expect(items.map((item) => item.label)).toEqual(["Owner planning"]);
  });

  it("classifies a New York evening due date as today", () => {
    const items = deriveOperationalAgenda({
      tasks: [{ id: "t1", title: "Follow up: STS Intake Test", projectId: null, clientId: null, dueDate: "2026-10-02", status: "todo", priority: "high", assignee: "Owner", notes: "" }],
      leads: [],
      invoices: [],
      projects: [],
      events: [],
      now: new Date("2026-10-03T01:59:00Z"),
    });
    expect(items.map((item) => item.bucket)).toEqual(["today"]);
  });

  it("classifies the next New York day as upcoming during the previous evening", () => {
    const items = deriveOperationalAgenda({
      tasks: [{ id: "t1", title: "Follow up: STS Intake Test", projectId: null, clientId: null, dueDate: "2026-10-02", status: "todo", priority: "high", assignee: "Owner", notes: "" }],
      leads: [],
      invoices: [],
      projects: [],
      events: [],
      now: new Date("2026-10-02T03:59:00Z"),
    });
    expect(items.map((item) => item.bucket)).toEqual(["upcoming"]);
  });

  it("keeps midday today, upcoming, and overdue classification", () => {
    const noon = new Date("2026-09-24T16:00:00Z");
    const task = (id: string, dueDate: string): TaskItem => ({
      id,
      title: id,
      projectId: null,
      clientId: null,
      dueDate,
      status: "todo",
      priority: "medium",
      assignee: "Owner",
      notes: "",
    });
    const items = deriveOperationalAgenda({
      tasks: [task("today", "2026-09-24"), task("upcoming", "2026-09-25"), task("overdue", "2026-09-23")],
      leads: [],
      invoices: [],
      projects: [],
      events: [],
      now: noon,
    });
    expect(items.find((item) => item.label === "today")?.bucket).toBe("today");
    expect(items.find((item) => item.label === "upcoming")?.bucket).toBe("upcoming");
    expect(items.find((item) => item.label === "overdue")?.bucket).toBe("overdue");
  });
});

describe("public intake migration", () => {
  it("keeps the write narrow, idempotent, and away from membership, portal, payment, and mail", () => {
    expect(intakeSql).toContain("security definer");
    expect(intakeSql).toContain("set search_path = pg_catalog, public");
    expect(intakeSql).toContain("slug = 'sts-media'");
    expect(intakeSql).toContain("constraint agency_intake_receipts_lead_key unique (lead_id)");
    expect(intakeSql).toContain("constraint agency_intake_receipts_task_key unique (task_id)");
    expect(intakeSql).toContain("alter table public.agency_intake_receipts force row level security");
    expect(intakeSql).toContain("revoke all on table public.agency_intake_receipts from public, anon, authenticated");
    expect(intakeSql).toContain("revoke all on function public.sts_capture_public_inquiry(uuid, text, text, text, text, text, text, text, text, text) from public, anon, authenticated");
    expect(intakeSql).toContain("grant execute on function public.sts_capture_public_inquiry(uuid, text, text, text, text, text, text, text, text, text) to service_role");
    expect(intakeSql).not.toMatch(/grant execute on function public\.sts_capture_public_inquiry\([\s\S]*\) to anon/i);
    expect(intakeSql).not.toMatch(/grant execute on function public\.sts_capture_public_inquiry\([\s\S]*\) to authenticated/i);
    expect(intakeSql).toContain("stage,\n    next_follow_up");
    expect(intakeSql).toContain("'new_inquiry'");
    expect(intakeSql).not.toMatch(/p_organization_id/);
    expect(intakeSql).not.toMatch(/insert into public\.organization_members/i);
    expect(intakeSql).not.toMatch(/client_portal_/);
    expect(intakeSql).not.toMatch(/ws_invoices|ws_estimates/);
    expect(intakeSql).not.toMatch(/pg_net|resend|smtp/i);
    expect(intakeSql).not.toMatch(/create or replace function public\.sts_(save_crm_lead|can_manage_crm|session_is_aal2|can_read_accountant_center|convert_ws_estimate_to_invoice)/);
    expect(intakeSql).not.toContain("'won'");
    expect(intakeSql).not.toContain("'paid'");
    expect(intakeSql).toContain("return jsonb_build_object('ok', true)");
    expect(intakeSql).not.toContain("'lead_id'");
    expect(intakeSql).not.toContain("'task_id'");
    expect(intakeSql).not.toContain("'organization_id'");
  });
});

describe("public contact action", () => {
  beforeEach(() => {
    resetWorkspace();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects a malformed submission without creating a lead or task", async () => {
    forwardedFor.ip = "203.0.113.41";
    const leads = getWorkspace().leads.length;
    const tasks = getWorkspace().tasks.length;
    const result = await submitContact(form({ name: "A", message: "short" }));
    expect(result.ok).toBeUndefined();
    expect(result.error).toBeTruthy();
    expect(getWorkspace().leads.length).toBe(leads);
    expect(getWorkspace().tasks.length).toBe(tasks);
  });

  it("rejects the sixth submission from the same address", async () => {
    forwardedFor.ip = "203.0.113.42";
    for (let index = 0; index < 5; index += 1) {
      const result = await submitContact(form({ submissionKey: `11111111-1111-4111-8111-11111111111${index}` }));
      expect(result.ok).toBe(true);
    }
    const leads = getWorkspace().leads.length;
    const blocked = await submitContact(form({ submissionKey: "11111111-1111-4111-8111-111111111119" }));
    expect(blocked).toEqual({ error: "Please wait before sending another message." });
    expect(getWorkspace().leads.length).toBe(leads);
  });

  it("does not grant membership or portal access and ignores a submitted organization id", async () => {
    forwardedFor.ip = "203.0.113.43";
    const clients = getWorkspace().clients.length;
    const result = await submitContact(form({ organizationId: "00000000-0000-4000-8000-000000000099" }));
    expect(result).toEqual({ ok: true });
    expect(getWorkspace().clients.length).toBe(clients);
    const lead = getWorkspace().leads.find((item) => item.id === `lead-${KEY}`);
    expect(lead?.stage).toBe("new_inquiry");
    expect(JSON.stringify(lead)).not.toContain("00000000-0000-4000-8000-000000000099");
    expect(lead?.stage).not.toBe("won");
    expect(getWorkspace().tasks.find((item) => item.id === `task-${KEY}`)?.status).toBe("todo");
    const source = readFileSync("src/app/actions.ts", "utf8");
    const body = source.slice(source.indexOf("export async function submitContact"), source.indexOf("export async function reportVulnerability"));
    expect(body).toContain("createServiceRoleClient");
    expect(body).not.toContain("createSupabaseServer");
    expect(body).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(body).not.toContain("NEXT_PUBLIC_");
    expect(body).not.toContain("organization_members");
    expect(body).not.toContain("client_portal");
  });

  it("fails closed when the service-role key is missing and does not write", async () => {
    forwardedFor.ip = "203.0.113.50";
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    serviceRpc.mockClear();
    const leads = getWorkspace().leads.length;
    const tasks = getWorkspace().tasks.length;
    const result = await submitContact(form({ submissionKey: "22222222-2222-4222-8222-222222222222" }));
    expect(result).toEqual({ error: PUBLIC_INTAKE_FAILURE });
    expect(serviceRpc).not.toHaveBeenCalled();
    expect(getWorkspace().leads.length).toBe(leads);
    expect(getWorkspace().tasks.length).toBe(tasks);
  });

  it("does not call the RPC for a bad payload or a rate-limited replay key", async () => {
    forwardedFor.ip = "203.0.113.51";
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
    serviceRpc.mockClear();
    const leads = getWorkspace().leads.length;
    const tasks = getWorkspace().tasks.length;
    const malformed = await submitContact(form({ name: "A", message: "short" }));
    expect(malformed.ok).toBeUndefined();
    expect(serviceRpc).not.toHaveBeenCalled();
    expect(getWorkspace().leads.length).toBe(leads);

    forwardedFor.ip = "203.0.113.53";
    for (let index = 0; index < 5; index += 1) {
      const result = await submitContact(form({ submissionKey: `33333333-3333-4333-8333-33333333333${index}` }));
      expect(result.ok).toBe(true);
    }
    expect(serviceRpc).toHaveBeenCalledTimes(5);
    const blocked = await submitContact(form({ submissionKey: "33333333-3333-4333-8333-333333333339" }));
    expect(blocked).toEqual({ error: "Please wait before sending another message." });
    expect(serviceRpc).toHaveBeenCalledTimes(5);
    expect(getWorkspace().leads.length).toBe(leads);

    const firstCall = serviceRpc.mock.calls[0];
    expect(firstCall?.[0]).toBe(PUBLIC_INTAKE_RPC);
    expect(JSON.stringify(firstCall?.[1])).not.toMatch(/organization/i);
    expect(firstCall?.[1]?.p_submission_key).toBe("33333333-3333-4333-8333-333333333330");

    forwardedFor.ip = "203.0.113.52";
    serviceRpc.mockClear();
    const replayKey = "44444444-4444-4444-8444-444444444444";
    expect((await submitContact(form({ submissionKey: replayKey }))).ok).toBe(true);
    expect((await submitContact(form({ submissionKey: replayKey }))).ok).toBe(true);
    expect(serviceRpc).toHaveBeenCalledTimes(2);
    expect(serviceRpc.mock.calls[0]?.[1]).toEqual(serviceRpc.mock.calls[1]?.[1]);
    expect(getWorkspace().leads.length).toBe(leads);
    expect(getWorkspace().tasks.length).toBe(tasks);
  });
});

import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_COOKIE } from "@/lib/config";
import { signDemoSession } from "@/lib/auth/demo-session";
import { getSession } from "@/lib/auth/session";
import { getWorkspace, resetWorkspace } from "@/lib/data/store";
import { STORAGE_NOT_CONFIGURED_MESSAGE } from "@/lib/receipts";
import { NOT_CONFIGURED_MESSAGE } from "@/lib/auth/phase1-flows";
import {
  acceptInvitation,
  completePasswordReset,
  saveNoteForm,
  startDemoSession,
  uploadExpenseReceipt,
  verifyMfaCode,
} from "@/app/actions";

const TEST_SECRET = "vitest-demo-session-secret-key-32ch";
const { cookieStore } = vi.hoisted(() => ({
  cookieStore: new Map<string, string>(),
}));

function cookieJar() {
  return {
    get(name: string) {
      const value = cookieStore.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set(name: string, value: string) {
      if (!value) cookieStore.delete(name);
      else cookieStore.set(name, value);
    },
    delete(nameOrOptions: string | { name: string }) {
      const name = typeof nameOrOptions === "string" ? nameOrOptions : nameOrOptions.name;
      cookieStore.delete(name);
    },
    getAll() {
      return [...cookieStore.entries()].map(([name, value]) => ({ name, value }));
    },
  };
}

vi.mock("next/headers", () => ({
  cookies: async () => cookieJar(),
  headers: async () => new Headers({ origin: "http://localhost:3000", host: "localhost:3000" }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      signOut: async () => ({ error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      updateUser: async () => ({ error: { message: "no session" } }),
      verifyOtp: async () => ({ error: { message: "invalid" } }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: "aal1" }, error: null }),
        listFactors: async () => ({ data: { totp: [], phone: [] }, error: null }),
        challenge: async () => ({ data: null, error: { message: "denied" } }),
        verify: async () => ({ error: { message: "denied" } }),
      },
    },
    storage: {
      from: () => ({
        upload: async () => ({ error: { message: "denied" } }),
      }),
    },
  })),
}));

async function expectRedirect(promise: Promise<unknown>, to: string) {
  await expect(promise).rejects.toThrow(`NEXT_REDIRECT:${to}`);
}

beforeEach(() => {
  cookieStore.clear();
  resetWorkspace();
  vi.stubEnv("NEXT_PUBLIC_ENABLE_DEMO_MODE", "true");
  vi.stubEnv("DEMO_SESSION_SECRET", TEST_SECRET);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("note relationship actions", () => {
  it("preserves, replaces, and removes note relationships through the owner write path", async () => {
    cookieStore.set(DEMO_COOKIE, await signDemoSession("owner", { secret: TEST_SECRET }));

    const preserve = new FormData();
    preserve.set("id", "note-1");
    preserve.set("title", "Updated without touching the link");
    preserve.set("body", "Body");
    preserve.set("pinned", "on");
    await saveNoteForm(preserve);
    expect(getWorkspace().notes.find((note) => note.id === "note-1")).toMatchObject({
      relatedType: "project",
      relatedId: "proj-scp",
      title: "Updated without touching the link",
    });

    const replace = new FormData();
    replace.set("id", "note-1");
    replace.set("title", "Linked to the client");
    replace.set("body", "Body");
    replace.set("relatedType", "client");
    replace.set("relatedId", "client-scp");
    replace.set("pinned", "on");
    await saveNoteForm(replace);
    expect(getWorkspace().notes.find((note) => note.id === "note-1")).toMatchObject({
      relatedType: "client",
      relatedId: "client-scp",
    });

    const remove = new FormData();
    remove.set("id", "note-1");
    remove.set("title", "Unlinked");
    remove.set("body", "Body");
    remove.set("relatedType", "none");
    remove.set("relatedId", "client-scp");
    await saveNoteForm(remove);
    expect(getWorkspace().notes.find((note) => note.id === "note-1")).toMatchObject({
      relatedType: "none",
      relatedId: null,
    });
  });
});

describe("auth screens fail closed", () => {
  it("does not start an owner session from an MFA code in demo mode", async () => {
    const formData = new FormData();
    formData.set("code", "123456");
    formData.set("mode", "owner");
    formData.set("next", "/dashboard");
    await expectRedirect(startDemoSession(formData), "/login");
    expect(cookieStore.has(DEMO_COOKIE)).toBe(false);
    expect((await getSession()).user).toBeNull();

    const result = await verifyMfaCode(formData);
    expect(result.grantOwnerSession).toBe(false);
    expect(result.error).toBe(NOT_CONFIGURED_MESSAGE);
    expect(cookieStore.has(DEMO_COOKIE)).toBe(false);
  });

  it("rejects reset and invitation completion without a verified backend token", async () => {
    const reset = new FormData();
    reset.set("password", "StsMedia#Owner2026");
    reset.set("confirm", "StsMedia#Owner2026");
    expect(await completePasswordReset(reset)).toMatchObject({ error: NOT_CONFIGURED_MESSAGE, status: "not_configured" });

    const invite = new FormData();
    invite.set("password", "StsMedia#Owner2026");
    expect(await acceptInvitation(invite)).toMatchObject({ error: NOT_CONFIGURED_MESSAGE, status: "not_configured" });
  });
});

describe("receipt upload storage-not-configured", () => {
  it("does not mark a receipt attached or report success when storage is unavailable", async () => {
    cookieStore.set(DEMO_COOKIE, await signDemoSession("owner", { secret: TEST_SECRET }));
    const before = getWorkspace().expenses.find((item) => item.id === "exp-ga-registration");
    expect(before?.receiptStatus).toBe("missing");

    const formData = new FormData();
    formData.set("expenseId", "exp-ga-registration");
    formData.set("file", new File(["%PDF"], "georgia-registration.pdf", { type: "application/pdf" }));
    const result = await uploadExpenseReceipt(formData);

    expect(result).toEqual({ error: STORAGE_NOT_CONFIGURED_MESSAGE, status: "storage_not_configured" });
    const after = getWorkspace().expenses.find((item) => item.id === "exp-ga-registration");
    expect(after?.receiptStatus).toBe("missing");
    expect(after?.receiptName).toBeNull();
  });
});

describe("repair wiring", () => {
  it("keeps the Command Center missing-receipts link and honors view=missing", () => {
    const overview = readFileSync("src/app/dashboard/page.tsx", "utf8");
    const expenses = readFileSync("src/app/dashboard/expenses/page.tsx", "utf8");
    const insights = readFileSync("src/lib/insights.ts", "utf8");
    expect(overview).toContain('href="/dashboard/expenses?view=missing"');
    expect(insights).toContain('href: "/dashboard/expenses?view=missing"');
    expect(expenses).toContain("parseExpenseLedgerView(params.view)");
    expect(expenses).toContain("initialView={initialView}");
  });

  it("removes the forced 1400px tablet ledger and keeps Duplicate and Receipt on mobile cards", () => {
    const ledger = readFileSync("src/components/dashboard/expense-ledger.tsx", "utf8");
    expect(ledger).not.toContain("min-w-[1400px]");
    expect(ledger).toContain("lg:hidden");
    expect(ledger).toContain("lg:block");
    expect(ledger).toContain(">Duplicate</Button>");
    expect(ledger).toContain(">Receipt</Button>");
    expect(ledger).toContain('type="file"');
    expect(ledger).toContain("uploadExpenseReceipt");
  });

  it("does not put passwords or codes in auth URLs or grant demo MFA sessions", () => {
    const reset = readFileSync("src/app/reset-password/page.tsx", "utf8");
    const invite = readFileSync("src/app/invite/accept/page.tsx", "utf8");
    const mfa = readFileSync("src/app/mfa/verify/page.tsx", "utf8");
    const enroll = readFileSync("src/app/mfa/enroll/page.tsx", "utf8");
    const changed = readFileSync("src/app/password-changed/page.tsx", "utf8");
    const accepted = readFileSync("src/app/invite/accepted/page.tsx", "utf8");
    const login = readFileSync("src/components/auth/login-form.tsx", "utf8");
    expect(reset).not.toContain('action="/password-changed"');
    expect(invite).not.toContain('action="/invite/accepted"');
    expect(mfa).not.toContain("startDemoSession");
    expect(mfa).not.toContain('action="/dashboard"');
    expect(enroll).not.toContain('action="/mfa/verify"');
    expect(changed).toContain("AuthFlowUnavailable");
    expect(accepted).toContain("AuthFlowUnavailable");
    expect(login).not.toContain("/login/code?email=");
  });

  it("uses the selected week helper instead of slicing the month grid", () => {
    const board = readFileSync("src/app/dashboard/calendar/calendar-board.tsx", "utf8");
    expect(board).toContain("calendarDays(view, cursor)");
    expect(board).not.toContain("days.slice(0, 7)");
    expect(board).toContain("Previous");
    expect(board).toContain("shiftCalendarCursor(cursor, view, -1)");
    expect(board).toContain("shiftCalendarCursor(cursor, view, 1)");
  });
});

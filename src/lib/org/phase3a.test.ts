import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { convertLeadInMemory, mapCrmLeadRow, normalizeIcpInput } from "./crm";
import { PIPELINE_COLUMNS, filterLeads, pipelineColumnForStage, pipelineCounts } from "./crm-pipeline";
import { computeSalesAnalytics } from "./crm-analytics";
import { deriveClientJourney } from "./client-journey";
import { clientHealth } from "./client-health";
import {
  commandCenterSnapshot,
  deriveOperationalAgenda,
  parseCommandCenterPeriod,
  periodFinancials,
} from "./command-center";
import { rangeFromPreset } from "@/lib/finance";
import type { Expense, Lead, Project, RevenueEntry, TaskItem, WorkspaceEstimate, WorkspaceInvoice } from "@/lib/types";

const lead = (overrides: Partial<Lead> = {}): Lead => ({
  id: "lead-1",
  businessName: "ABC Roofing",
  contactName: "Pat",
  email: "pat@example.com",
  phone: "404-555-0100",
  source: "Manual",
  requestedService: "Website",
  estimatedValue: 4000,
  probability: 40,
  stage: "new_inquiry",
  lastContact: null,
  nextFollowUp: "2026-09-24",
  callsMade: 0,
  emailsSent: 0,
  meetings: 0,
  notes: "",
  assignedTo: "Owner",
  createdAt: "2026-09-10",
  icpId: null,
  convertedClientId: null,
  ...overrides,
});

describe("CRM stage UI mapping", () => {
  it("maps database stages onto the user-facing pipeline without rewriting them", () => {
    expect(pipelineColumnForStage("new_inquiry").label).toBe("New Lead");
    expect(pipelineColumnForStage("discovery_scheduled").label).toBe("Discovery");
    expect(pipelineColumnForStage("discovery_completed").label).toBe("Discovery");
    expect(pipelineColumnForStage("proposal_sent").label).toBe("Proposal");
    expect(pipelineColumnForStage("negotiating").label).toBe("Negotiation");
    expect(PIPELINE_COLUMNS.flatMap((column) => [...column.stages])).toEqual([
      "new_inquiry",
      "contacted",
      "discovery_scheduled",
      "discovery_completed",
      "proposal_sent",
      "negotiating",
      "won",
      "lost",
      "nurture",
    ]);
  });
});

describe("lead conversion", () => {
  it("creates a client once and is idempotent", () => {
    const first = convertLeadInMemory([lead()], [], "lead-1");
    if ("error" in first) throw new Error("expected conversion");
    expect(first.clients).toHaveLength(1);
    expect(first.leads[0].convertedClientId).toBe(first.clientId);
    expect(first.leads[0].businessName).toBe("ABC Roofing");
    const second = convertLeadInMemory(first.leads, first.clients, "lead-1");
    if ("error" in second) throw new Error("expected conversion");
    expect(second.clients).toHaveLength(1);
    expect(second.clientId).toBe(first.clientId);
  });

  it("links an existing same-email client instead of duplicating", () => {
    const existing = {
      id: "client-1",
      businessName: "ABC Roofing LLC",
      contactName: "Pat",
      email: "pat@example.com",
      phone: "",
      industry: "",
      status: "active" as const,
      portalEnabled: false,
      notes: "",
    };
    const converted = convertLeadInMemory([lead()], [existing], "lead-1");
    if ("error" in converted) throw new Error("expected conversion");
    expect(converted.clients).toHaveLength(1);
    expect(converted.clientId).toBe("client-1");
  });
});

describe("journey derivation", () => {
  it("marks stages complete only when supporting records exist", () => {
    const steps = deriveClientJourney({
      lead: lead({ stage: "discovery_completed" }),
      estimates: [],
      invoices: [],
      projects: [],
      portalPublished: false,
    });
    expect(steps.find((step) => step.id === "lead")?.status).toBe("complete");
    expect(steps.find((step) => step.id === "discovery")?.status).toBe("complete");
    expect(steps.find((step) => step.id === "invoice")?.status).toBe("pending");
    expect(steps.find((step) => step.id === "payment")?.status).toBe("pending");
    expect(steps.find((step) => step.id === "recurring")?.status).toBe("future");
    expect(steps.find((step) => step.id === "testimonial")?.status).toBe("future");
  });

  it("completes payment only after a paid invoice exists", () => {
    const invoice: WorkspaceInvoice = {
      id: "inv-1",
      invoiceNumber: "STS-1004",
      status: "issued",
      clientId: "client-1",
      issueDate: "2026-09-01",
      dueDate: "2026-09-15",
      currency: "USD",
      notes: "",
      paymentInstructions: "",
      orgLegalName: "",
      orgDisplayName: "",
      clientBusinessName: "ABC",
      clientContactName: "",
      clientEmail: "",
      subtotalCents: 10000,
      discountCents: 0,
      taxCents: 0,
      totalCents: 10000,
      amountPaidCents: 0,
      lines: [],
      sourceEstimateId: null,
      sourceEstimateNumber: "",
      issuedAt: "2026-09-01",
      paidAt: null,
      voidedAt: null,
      archived: false,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
    };
    const pending = deriveClientJourney({
      lead: lead({ stage: "won" }),
      estimates: [{
        id: "est-1",
        estimateNumber: "EST-1",
        status: "accepted",
        title: "Site",
        description: "",
        clientId: "client-1",
        issueDate: "2026-08-01",
        expiresOn: null,
        currency: "USD",
        internalNotes: "",
        customerNotes: "",
        terms: "",
        orgLegalName: "",
        orgDisplayName: "",
        clientBusinessName: "",
        clientContactName: "",
        clientEmail: "",
        subtotalCents: 10000,
        discountCents: 0,
        taxCents: 0,
        totalCents: 10000,
        lines: [],
        readyAt: "2026-08-01",
        acceptedAt: "2026-08-02",
        declinedAt: null,
        expiredAt: null,
        archived: false,
        createdAt: "2026-08-01",
        updatedAt: "2026-08-02",
      } satisfies WorkspaceEstimate],
      invoices: [invoice],
      projects: [],
      portalPublished: false,
    });
    expect(pending.find((step) => step.id === "estimate_accepted")?.status).toBe("complete");
    expect(pending.find((step) => step.id === "payment")?.status).toBe("current");
    const paid = deriveClientJourney({
      lead: lead({ stage: "won" }),
      estimates: [],
      invoices: [{ ...invoice, status: "paid", amountPaidCents: 10000, paidAt: "2026-09-20" }],
      projects: [],
      portalPublished: false,
    });
    expect(paid.find((step) => step.id === "payment")?.status).toBe("complete");
  });
});

describe("sales analytics empty handling", () => {
  it("shows Not enough data instead of 0% when the denominator is zero", () => {
    const empty = computeSalesAnalytics([]);
    expect(empty.hasActivity).toBe(false);
    expect(empty.closeRate).toBe("Not enough data");
    expect(empty.leadToEstimate).toBe("Not enough data");
    expect(empty.estimateToClient).toBe("Not enough data");
    expect(empty.averageDealValue).toBe("Not enough data");
    const onlyOpen = computeSalesAnalytics([lead(), lead({ id: "lead-2", stage: "contacted" })]);
    expect(onlyOpen.hasActivity).toBe(true);
    expect(onlyOpen.closeRate).toBe("Not enough data");
    expect(onlyOpen.totalLeads).toBe(2);
  });
});

describe("date ranges and command center period metrics", () => {
  it("supports this month and last month presets", () => {
    const now = new Date("2026-09-24T12:00:00");
    const month = rangeFromPreset("month", undefined, undefined, now);
    const last = rangeFromPreset("last_month", undefined, undefined, now);
    expect(month.from.getMonth()).toBe(8);
    expect(last.from.getMonth()).toBe(7);
    expect(parseCommandCenterPeriod("quarter")).toBe("quarter");
    expect(parseCommandCenterPeriod("nope")).toBe("month");
  });

  it("applies the period to revenue and expenses but not outstanding invoices", () => {
    const now = new Date("2026-09-24T12:00:00");
    const range = rangeFromPreset("month", undefined, undefined, now);
    const expenses: Expense[] = [
      {
        id: "e1",
        transactionDate: "2026-09-02",
        postedDate: "2026-09-02",
        vendor: "Host",
        description: "Hosting",
        pretaxAmount: 20,
        salesTax: 0,
        totalAmount: 20,
        currency: "USD",
        category: "Website hosting",
        subcategory: "",
        clientId: null,
        projectId: null,
        businessPurpose: "",
        paymentAccount: "",
        paymentMethod: "",
        recurring: false,
        billingFrequency: "one_time",
        receiptName: null,
        receiptStatus: "missing",
        reimbursable: false,
        reimbursementStatus: "n/a",
        notes: "",
        archived: false,
        directProjectCost: false,
        taxReviewStatus: "reviewed",
        deductibilityStatus: "likely_deductible",
        taxYear: 2026,
        createdBy: "Owner",
        createdAt: "2026-09-02",
        updatedAt: "2026-09-02",
        confirmationStatus: "confirmed",
        demoLabel: false,
      },
      {
        id: "e2",
        transactionDate: "2026-08-02",
        postedDate: "2026-08-02",
        vendor: "Host",
        description: "Old hosting",
        pretaxAmount: 50,
        salesTax: 0,
        totalAmount: 50,
        currency: "USD",
        category: "Website hosting",
        subcategory: "",
        clientId: null,
        projectId: null,
        businessPurpose: "",
        paymentAccount: "",
        paymentMethod: "",
        recurring: false,
        billingFrequency: "one_time",
        receiptName: null,
        receiptStatus: "missing",
        reimbursable: false,
        reimbursementStatus: "n/a",
        notes: "",
        archived: false,
        directProjectCost: false,
        taxReviewStatus: "reviewed",
        deductibilityStatus: "likely_deductible",
        taxYear: 2026,
        createdBy: "Owner",
        createdAt: "2026-08-02",
        updatedAt: "2026-08-02",
        confirmationStatus: "confirmed",
        demoLabel: false,
      },
    ];
    const revenue: RevenueEntry[] = [
      {
        id: "r1",
        date: "2026-09-05",
        type: "one_time_project",
        description: "Build",
        amount: 500,
        currency: "USD",
        clientId: "c1",
        projectId: null,
        service: "Website",
        invoiceStatus: "paid",
        paymentStatus: "paid",
        dueDate: null,
        stripeCustomerId: "",
        stripeSubscriptionId: "",
        recognized: true,
        notes: "",
        demoLabel: false,
      },
      {
        id: "r2",
        date: "2026-08-05",
        type: "one_time_project",
        description: "Old build",
        amount: 900,
        currency: "USD",
        clientId: "c1",
        projectId: null,
        service: "Website",
        invoiceStatus: "paid",
        paymentStatus: "paid",
        dueDate: null,
        stripeCustomerId: "",
        stripeSubscriptionId: "",
        recognized: true,
        notes: "",
        demoLabel: false,
      },
    ];
    const invoices: WorkspaceInvoice[] = [
      {
        id: "inv-open",
        invoiceNumber: "STS-9",
        status: "issued",
        clientId: "c1",
        issueDate: "2026-08-01",
        dueDate: "2026-09-30",
        currency: "USD",
        notes: "",
        paymentInstructions: "",
        orgLegalName: "",
        orgDisplayName: "",
        clientBusinessName: "",
        clientContactName: "",
        clientEmail: "",
        subtotalCents: 25000,
        discountCents: 0,
        taxCents: 0,
        totalCents: 25000,
        amountPaidCents: 0,
        lines: [],
        sourceEstimateId: null,
        sourceEstimateNumber: "",
        issuedAt: "2026-08-01",
        paidAt: null,
        voidedAt: null,
        archived: false,
        createdAt: "2026-08-01",
        updatedAt: "2026-08-01",
      },
    ];
    const financials = periodFinancials({
      expenses,
      revenue,
      invoices,
      projects: [],
      tasks: [],
      range,
      now,
    });
    expect(financials.totalRevenue).toBe(500);
    expect(financials.totalExpenses).toBe(20);
    expect(financials.outstandingInvoices).toBe(250);
    const snapshot = commandCenterSnapshot({
      expenses,
      revenue,
      invoices,
      projects: [],
      tasks: [],
      activeClients: 2,
      source: "postgres",
      period: "month",
      now,
    });
    expect(snapshot.mrrAvailable).toBe(false);
    expect(snapshot.mrrNote).toMatch(/Postgres/);
    expect(snapshot.revenue).toBe(500);
    expect(snapshot.activeClients).toBe(2);
  });
});

describe("agenda derivation", () => {
  it("aggregates existing tasks, follow-ups, invoices, and deadlines", () => {
    const items = deriveOperationalAgenda({
      now: new Date("2026-09-24T12:00:00Z"),
      tasks: [{ id: "t1", title: "Client review due", projectId: null, clientId: "c1", dueDate: "2026-09-24", status: "todo", priority: "medium", assignee: "Owner", notes: "" } satisfies TaskItem],
      leads: [lead({ nextFollowUp: "2026-09-24" })],
      invoices: [{
        id: "inv-1",
        invoiceNumber: "1004",
        status: "issued",
        clientId: "c1",
        issueDate: "2026-09-01",
        dueDate: "2026-09-24",
        currency: "USD",
        notes: "",
        paymentInstructions: "",
        orgLegalName: "",
        orgDisplayName: "",
        clientBusinessName: "",
        clientContactName: "",
        clientEmail: "",
        subtotalCents: 100,
        discountCents: 0,
        taxCents: 0,
        totalCents: 100,
        amountPaidCents: 0,
        lines: [],
        sourceEstimateId: null,
        sourceEstimateNumber: "",
        issuedAt: null,
        paidAt: null,
        voidedAt: null,
        archived: false,
        createdAt: "2026-09-01",
        updatedAt: "2026-09-01",
      }],
      projects: [{
        id: "p1",
        name: "State Collision — Website launch",
        clientId: "c1",
        packageId: null,
        stage: "in_development",
        startDate: "2026-09-01",
        deadline: "2026-09-24",
        budget: 0,
        amountInvoiced: 0,
        amountCollected: 0,
        directCost: 0,
        githubRepo: "",
        vercelProject: "",
        productionUrl: "",
        domain: "",
        maintenancePlan: "",
        credentialsReference: "",
        notes: "",
        atRisk: false,
      } satisfies Project],
      events: [],
    });
    expect(items.filter((item) => item.bucket === "today").map((item) => item.label)).toEqual(
      expect.arrayContaining([
        "Client review due",
        "Lead follow-up — ABC Roofing",
        "Invoice 1004 due",
        "State Collision — Website launch — deadline",
      ]),
    );
  });
});

describe("client health", () => {
  it("explains overdue invoices instead of using a score", () => {
    const health = clientHealth({
      now: new Date("2026-09-24T12:00:00Z"),
      invoices: [{
        id: "inv-1",
        invoiceNumber: "104",
        status: "issued",
        clientId: "c1",
        issueDate: "2026-09-01",
        dueDate: "2026-09-16",
        currency: "USD",
        notes: "",
        paymentInstructions: "",
        orgLegalName: "",
        orgDisplayName: "",
        clientBusinessName: "",
        clientContactName: "",
        clientEmail: "",
        subtotalCents: 100,
        discountCents: 0,
        taxCents: 0,
        totalCents: 100,
        amountPaidCents: 0,
        lines: [],
        sourceEstimateId: null,
        sourceEstimateNumber: "",
        issuedAt: null,
        paidAt: null,
        voidedAt: null,
        archived: false,
        createdAt: "2026-09-01",
        updatedAt: "2026-09-01",
      }],
      projects: [],
      tasks: [],
    });
    expect(health.label).toBe("Needs Attention");
    expect(health.reason).toBe("Invoice 104 is 8 days overdue.");
  });
});

describe("ICP helpers and pipeline filters", () => {
  it("normalizes ICP budgets and filters leads by ICP", () => {
    const icp = normalizeIcpInput({ name: "Collision shops", estimatedBudgetMin: 2000, estimatedBudgetMax: 800 });
    expect(icp.estimatedBudgetMax).toBe(2000);
    expect(filterLeads([lead({ icpId: "icp-1" }), lead({ id: "l2", icpId: "icp-2" })], { icp: "icp-1" })).toHaveLength(1);
    expect(pipelineCounts([lead({ stage: "won" }), lead({ id: "l2", stage: "lost" })]).won).toBe(1);
  });

  it("maps optional conversion columns from database rows", () => {
    const mapped = mapCrmLeadRow({
      id: "22222222-2222-4222-8222-222222222222",
      business_name: "New inquiry",
      contact_name: "",
      email: "",
      phone: "",
      source: "Manual",
      requested_service: "",
      estimated_value_cents: 0,
      probability: 10,
      stage: "new_inquiry",
      last_contact: null,
      next_follow_up: null,
      calls_made: 0,
      emails_sent: 0,
      meetings: 0,
      notes: "",
      assigned_to: "Owner",
      created_at: "2026-09-19T00:00:00.000Z",
      icp_id: null,
      converted_client_id: null,
    });
    expect(mapped.convertedClientId).toBeNull();
  });
});

describe("phase 3A security source review", () => {
  it("keeps CRM RPCs authenticated-only and organization scoped", () => {
    const sql = readFileSync("supabase/migrations/20260924063409_phase3a_crm_journey.sql", "utf8");
    const isolation = readFileSync("supabase/tests/phase3a_isolation_runtime.sql", "utf8");
    expect(sql).toContain("if not public.sts_can_manage_crm(p_organization_id)");
    expect(sql).toContain("grant execute on function public.sts_convert_crm_lead_to_client(uuid, uuid) to authenticated");
    expect(sql).toContain("revoke all on public.crm_icps from anon, public");
    expect(isolation).toContain("set local role anon");
    expect(isolation).toContain("aal1");
    expect(isolation).toContain("'client'");
    expect(isolation).toContain("sts_convert_crm_lead_to_client");
  });
});

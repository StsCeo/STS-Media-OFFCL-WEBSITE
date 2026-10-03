import { describe, expect, it } from "vitest";
import {
  GENERIC_CRM_ERROR,
  isPersistedCrmId,
  mapCrmClientRow,
  mapCrmLeadRow,
  normalizeClientInput,
  normalizeLeadInput,
} from "./crm";

describe("CRM persistence helpers", () => {
  it("maps database rows without enabling a client portal", () => {
    const client = mapCrmClientRow({
      id: "11111111-1111-4111-8111-111111111111",
      business_name: "State Collision Pro",
      contact_name: "Jordan",
      email: "ops@example.com",
      phone: "404-555-0100",
      industry: "Auto",
      status: "active",
      notes: "Existing client",
    });
    expect(client.portalEnabled).toBe(false);
    expect(client.businessName).toBe("State Collision Pro");

    const lead = mapCrmLeadRow({
      id: "22222222-2222-4222-8222-222222222222",
      business_name: "New inquiry",
      contact_name: "",
      email: "",
      phone: "",
      source: "Manual",
      requested_service: "",
      estimated_value_cents: 250000,
      probability: 20,
      stage: "contacted",
      last_contact: null,
      next_follow_up: null,
      calls_made: 1,
      emails_sent: 0,
      meetings: 0,
      notes: "",
      assigned_to: "Owner",
      created_at: "2026-09-19T00:00:00.000Z",
    });
    expect(lead.estimatedValue).toBe(2500);
    expect(lead.stage).toBe("contacted");
  });

  it("rejects non-uuid in-memory ids as persisted CRM ids", () => {
    expect(isPersistedCrmId("lead-123")).toBe(false);
    expect(isPersistedCrmId("11111111-1111-4111-8111-111111111111")).toBe(true);
  });

  it("normalizes writes and never enables a portal", () => {
    expect(normalizeClientInput({ businessName: "Acme", status: "paused" })).toMatchObject({
      businessName: "Acme",
      status: "paused",
      portalEnabled: false,
    });
    const lead = normalizeLeadInput({ stage: "won" }, {
      id: "lead-1",
      businessName: "Keep name",
      contactName: "",
      email: "",
      phone: "",
      source: "Manual",
      requestedService: "",
      estimatedValue: 100,
      probability: 10,
      stage: "new_inquiry",
      lastContact: null,
      nextFollowUp: null,
      callsMade: 0,
      emailsSent: 0,
      meetings: 0,
      notes: "",
      assignedTo: "Owner",
      createdAt: "2026-09-19",
    });
    expect(lead.businessName).toBe("Keep name");
    expect(lead.stage).toBe("won");
    expect(GENERIC_CRM_ERROR).not.toMatch(/password|secret|token/i);
  });
});

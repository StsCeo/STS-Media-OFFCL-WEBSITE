import type { OrganizationFoundationState } from "./types";

export const DEMO_ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
export const DEMO_OWNER_USER_ID = "user-owner";
export const DEMO_SETTINGS_ID = "22222222-2222-4222-8222-222222222222";
export const DEMO_MEMBER_ID = "33333333-3333-4333-8333-333333333333";

export function createDemoOrganizationFoundation(now = new Date()): OrganizationFoundationState {
  const stamp = now.toISOString();
  return {
    organizations: [
      {
        id: DEMO_ORGANIZATION_ID,
        legalName: "Scars to Stars Media",
        displayName: "STS Media",
        slug: "sts-media",
        baseCurrency: "USD",
        timezone: "America/New_York",
        fiscalYearStart: 1,
        createdAt: stamp,
        updatedAt: stamp,
      },
    ],
    members: [
      {
        id: DEMO_MEMBER_ID,
        organizationId: DEMO_ORGANIZATION_ID,
        userId: DEMO_OWNER_USER_ID,
        role: "owner",
        status: "active",
        invitedAt: stamp,
        acceptedAt: stamp,
        createdAt: stamp,
        updatedAt: stamp,
      },
    ],
    settings: [
      {
        id: DEMO_SETTINGS_ID,
        organizationId: DEMO_ORGANIZATION_ID,
        invoicePrefix: "STS",
        estimatePrefix: "EST",
        defaultPaymentTerms: "Net 15",
        brandSettings: {
          paletteId: "charcoal-sage",
          accentColor: "",
          logoText: "STS",
        },
        notificationSettings: {
          emailInvoices: false,
          emailEstimates: false,
        },
        createdAt: stamp,
        updatedAt: stamp,
      },
    ],
    auditEvents: [],
  };
}

import { DEFAULT_OWNER_EMAIL } from "@/lib/auth/owner";
import type { BusinessProfile } from "@/lib/types";

export function defaultBusinessProfile(): BusinessProfile {
  return {
    legalName: "Scars to Stars Media",
    dba: "STS Media",
    entityType: "llc",
    federalClassification: "tbd",
    formationState: "Georgia",
    accountingMethod: "cash",
    fiscalYearType: "calendar",
    fiscalYearStartMonth: 1,
    timezone: "America/New_York",
    currency: "USD",
    website: "https://stsmedia.co",
    publicEmail: "hello@stsmedia.co",
    ownerEmail: DEFAULT_OWNER_EMAIL,
    taxReservePercent: 0,
    reservedTaxAmountCents: 0,
    invoiceNumberFormat: "STS-{YYYY}-{####}",
    defaultPaymentTerms: "Net 15",
    defaultDepositPercent: 50,
    sCorpStatus: "not_elected",
    sCorpNotes: "S-corp status is recorded only. This system does not recommend an election.",
    einStored: false,
    notes: "Editable operating defaults. Confirm with a qualified professional before filing.",
  };
}

import { describe, expect, it } from "vitest";
import { createSeedWorkspace } from "./data/seed";
import { dollarsToCents } from "./money";
import { buildMasterTransactionLog } from "./os-transactions";

describe("master transaction log", () => {
  it("converts dollar ledgers into signed cents and includes unpaid income", () => {
    const workspace = createSeedWorkspace();
    const rows = buildMasterTransactionLog(workspace);
    const ga = rows.find((row) => row.id === "expense:exp-ga-registration");
    const invoice = rows.find((row) => row.id === "revenue:rev-scp-build");
    expect(ga?.amountCents).toBe(-dollarsToCents(60));
    expect(invoice?.amountCents).toBe(dollarsToCents(500));
    expect(invoice?.status).toBe("unpaid");
    expect(rows.every((row) => Number.isInteger(row.amountCents))).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { computeFinance, rangeFromPreset } from "./finance";
import { createSeedWorkspace } from "./data/seed";
import { buildOverviewKpis, formatKpiValue } from "./kpi";
import { formatCurrency } from "./utils";

describe("KPI formatting", () => {
  it("formats client, project, and email counts as whole numbers instead of currency", () => {
    expect(formatKpiValue(1, "count")).toBe("1");
    expect(formatKpiValue(5, "count")).toBe("5");
    expect(formatKpiValue(0, "count")).toBe("0");
    expect(formatKpiValue(5, "count")).not.toContain("$");
    expect(formatKpiValue(1, "count")).not.toBe(formatCurrency(1));
  });

  it("keeps revenue, expense, and profit values formatted as money", () => {
    expect(formatKpiValue(500, "money")).toBe(formatCurrency(500));
    expect(formatKpiValue(31.05, "money")).toBe(formatCurrency(31.05));
    expect(formatKpiValue(-60, "money")).toBe(formatCurrency(-60));
  });

  it("builds Command Center KPIs with count formats for operating counts", () => {
    const workspace = createSeedWorkspace();
    const metrics = computeFinance(workspace, rangeFromPreset("year", undefined, undefined, new Date("2026-09-11T12:00:00")));
    const kpis = buildOverviewKpis(workspace, metrics, 0);
    const byLabel = Object.fromEntries(kpis.map((kpi) => [kpi.label, kpi]));

    expect(byLabel["Active clients"].format).toBe("count");
    expect(byLabel["Active projects"].format).toBe("count");
    expect(byLabel["Emails sent"].format).toBe("count");
    expect(formatKpiValue(byLabel["Active clients"].value, "count")).toBe("1");
    expect(formatKpiValue(byLabel["Emails sent"].value, "count")).toBe("5");
    expect(formatKpiValue(byLabel["Active clients"].value, "count")).not.toMatch(/\$/);
    expect(formatKpiValue(byLabel["Emails sent"].value, "count")).not.toMatch(/\$/);

    expect(byLabel["Gross revenue"].format).toBe("money");
    expect(byLabel["Total expenses"].format).toBe("money");
    expect(byLabel["Net profit"].format).toBe("money");
    expect(formatKpiValue(byLabel["Gross revenue"].value, "money")).toMatch(/\$/);
  });
});

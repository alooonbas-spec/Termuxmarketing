import { describe, expect, it } from "vitest";
import { dashboardCss, dashboardHtml, dashboardJs } from "./assets.js";

describe("dashboard assets", () => {
  it("contains the lead table and API integration", () => {
    expect(dashboardHtml).toContain('id="rows"');
    expect(dashboardHtml).toContain('/dashboard.js');
    expect(dashboardJs).toContain('/api/stats');
    expect(dashboardJs).toContain('/api/leads.csv');
    expect(dashboardCss).toContain('@media');
  });
});

import { describe, expect, it } from "vitest";
import { dashboardAssetVersion, dashboardCss, dashboardHtml, dashboardJs } from "./assets.js";

describe("dashboard assets", () => {
  it("contains the lead table and API integration", () => {
    expect(dashboardHtml).toContain('id="rows"');
    expect(dashboardHtml).toContain(`/dashboard.js?v=${dashboardAssetVersion}`);
    expect(dashboardJs).toContain("/api/stats");
    expect(dashboardJs).toContain("/api/leads.csv");
    expect(dashboardCss).toContain("@media");
  });

  it("emits syntactically valid dashboard.js (template-literal escapes must survive)", () => {
    expect(() => new Function(dashboardJs)).not.toThrow();
    expect(dashboardJs).toContain("split(/\\n---\\n/)");
    expect(dashboardJs).not.toMatch(/split\(\/\n/);
  });

  it("opens the API key modal from #settings without relying on HTML onclick attributes", () => {
    expect(dashboardHtml).toContain('id="settings"');
    expect(dashboardHtml).toContain('id="keyModal"');
    expect(dashboardHtml).not.toContain("onclick=");
    expect(dashboardJs).toContain('openKeyModal');
    expect(dashboardJs).toContain('$("settings").onclick = openKeyModal');
    expect(dashboardJs).toContain('classList.remove("hidden")');
  });

  it("prompts for the API key instead of leaving the panel inert", () => {
    expect(dashboardHtml).not.toContain("ОЖИДАНИЕ ЗАПУСКА JS");
    expect(dashboardCss).toContain("z-index:2000");
    expect(dashboardJs).toContain('if (!key())');
    expect(dashboardJs).toContain("openKeyModal()");
  });
});

import { describe, expect, it } from "vitest";
import { dashboardAssetVersion, dashboardCss, dashboardHtml, dashboardJs } from "./assets.js";

describe("dashboard assets", () => {
  it("contains the lead table and API integration", () => {
    expect(dashboardHtml).toContain('id="rows"');
    expect(dashboardHtml).toContain(`/dashboard.css?v=${dashboardAssetVersion}`);
    expect(dashboardHtml).toContain(dashboardJs);
    expect(dashboardJs).toContain("/api/stats");
    expect(dashboardJs).toContain("/api/leads.csv");
    expect(dashboardCss).toContain("@media");
  });

  it("emits syntactically valid dashboard.js (template-literal escapes must survive)", () => {
    expect(() => new Function(dashboardJs)).not.toThrow();
    expect(dashboardJs).not.toMatch(/split\(\/\n/);
  });

  it("shows a key window with the API-ключ button beside it", () => {
    expect(dashboardHtml).toContain('id="keyForm"');
    expect(dashboardHtml).toContain('id="keyInput"');
    expect(dashboardHtml).toContain('id="settings"');
    expect(dashboardHtml).toContain(">API-ключ</button>");
    expect(dashboardHtml).toContain("Окно для ключа");
    expect(dashboardHtml).not.toContain("keyModal");
    expect(dashboardHtml).not.toContain("ОЖИДАНИЕ ЗАПУСКА JS");
    expect(dashboardJs).toContain('$("keyForm").onsubmit');
    expect(dashboardJs).toContain("collectorApiKey");
  });
});

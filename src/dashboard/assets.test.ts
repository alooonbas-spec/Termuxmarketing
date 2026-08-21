import { describe, expect, it } from "vitest";
import { dashboardCss, dashboardHtml, dashboardJs } from "./assets.js";

describe("dashboard assets", () => {
  it("contains the lead table and API integration", () => {
    expect(dashboardHtml).toContain('id="rows"');
    // Скрипт теперь встроен в HTML напрямую (см. app.ts), а не подключается
    // отдельным файлом — так надёжнее на Android-браузерах, где отдельный
    // запрос к /dashboard.js мог не выполняться из-за кэша/CSP-апгрейда.
    expect(dashboardHtml).toContain('<script>');
    expect(dashboardHtml).toContain(dashboardJs);
    expect(dashboardJs).toContain('/api/stats');
    expect(dashboardJs).toContain('/api/leads.csv');
    expect(dashboardCss).toContain('@media');
  });
});

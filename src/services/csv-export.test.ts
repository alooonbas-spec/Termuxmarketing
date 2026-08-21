import { describe, expect, it } from "vitest";
import { leadsToCsv } from "./csv-export.js";
import type { Lead } from "../domain/lead.js";

describe("CSV export", () => {
  it("escapes commas and quotes", () => {
    const now = new Date("2026-08-02T00:00:00.000Z");
    const lead: Lead = { id: "1", platform: "vk", platformUserId: "2", displayName: "Ivan, \"Investor\"",
      sourceType: "message", sourceId: "3", consentStatus: "confirmed",
      contacts: { phones: ["+79991234567"], emails: [], telegram: [], urls: [] },
      rawEvent: {}, collectedAt: now, createdAt: now, updatedAt: now, score: 55 };
    expect(leadsToCsv([lead])).toContain('"Ivan, ""Investor"""');
  });
});

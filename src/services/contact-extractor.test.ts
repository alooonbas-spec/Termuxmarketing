import { describe, expect, it } from "vitest";
import { extractContacts, normalizePhone } from "./contact-extractor.js";

describe("contact extractor", () => {
  it("normalizes Russian phone numbers", () => {
    expect(normalizePhone("8 (999) 123-45-67")).toBe("+79991234567");
  });

  it("extracts and deduplicates contacts", () => {
    const result = extractContacts("Пишите test@Example.com, +7 999 123-45-67, @investor_max и https://example.com");
    expect(result.emails).toEqual(["test@example.com"]);
    expect(result.phones).toEqual(["+79991234567"]);
    expect(result.telegram).toEqual(["@investor_max"]);
    expect(result.urls).toEqual(["https://example.com"]);
  });
});

import { describe, expect, it } from "vitest";
import { chooseVariant, renderTemplate, validateTemplate } from "./template-renderer.js";

describe("outreach templates", () => {
  it("renders allowed variables", () => expect(renderTemplate("Здравствуйте, {{ firstName }}!", { firstName: "Максим" })).toBe("Здравствуйте, Максим!"));
  it("rejects unknown variables", () => expect(() => validateTemplate("{{password}}")).toThrow("Unknown template variables"));
  it("selects a stable variant", () => expect(chooseVariant(["A","B","C"], "campaign:lead")).toBe(chooseVariant(["A","B","C"], "campaign:lead")));
});

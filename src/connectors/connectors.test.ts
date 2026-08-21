import { describe, expect, it } from "vitest";
import { TelegramConnector } from "./telegram.js";
import { VkConnector } from "./vk.js";
import { MetaConnector } from "./meta.js";
import { XConnector } from "./x.js";
import { RedditConnector } from "./reddit.js";
import { PinterestConnector } from "./pinterest.js";
import { LimitedPlatformConnector } from "./limited-platform.js";

describe("platform connectors", () => {
  it("parses a Telegram shared contact", () => {
    const [lead] = new TelegramConnector().parse({
      update_id: 1,
      message: { message_id: 2, from: { id: 7, username: "max_test", first_name: "Max" }, contact: { phone_number: "+79991234567" } },
    });
    expect(lead?.contacts.phones).toEqual(["+79991234567"]);
    expect(lead?.consentStatus).toBe("confirmed");
  });

  it("parses a VK community message", () => {
    const [lead] = new VkConnector().parse({ type: "message_new", event_id: "vk-1", object: { message: { id: 2, from_id: 9, text: "mail@test.ru" } } });
    expect(lead?.contacts.emails).toEqual(["mail@test.ru"]);
  });

  it("parses Meta messages", () => {
    const [lead] = new MetaConnector("instagram").parse({ object: "instagram", entry: [{ messaging: [{ sender: { id: "10" }, message: { mid: "m1", text: "@investor_max" } }] }] });
    expect(lead?.platform).toBe("instagram");
    expect(lead?.contacts.telegram).toEqual(["@investor_max"]);
  });

  it("parses X API responses", () => {
    const [lead] = new XConnector().parse({ data: [{ id: "1", author_id: "2", text: "invest@example.com" }], includes: { users: [{ id: "2", username: "investor" }] } });
    expect(lead?.contacts.emails).toEqual(["invest@example.com"]);
  });

  it("parses Reddit listings", () => {
    const [lead] = new RedditConnector().parse({ data: { children: [{ data: { id: "r1", author: "max", body: "@investor_max" } }] } });
    expect(lead?.contacts.telegram).toEqual(["@investor_max"]);
  });

  it("parses Pinterest pins", () => {
    const [lead] = new PinterestConnector().parse({ items: [{ id: "p1", description: "+7 999 123-45-67", board_owner: { username: "company" } }] });
    expect(lead?.contacts.phones).toEqual(["+79991234567"]);
  });

  it.each(["linkedin", "dzen", "quora"] as const)("parses authorized %s imports", (platform) => {
    const [lead] = new LimitedPlatformConnector(platform).parse({ records: [{
      id: `${platform}-1`, userId: "user-1", email: "investor@example.com", consent: true,
    }] });
    expect(lead?.platform).toBe(platform);
    expect(lead?.contacts.emails).toEqual(["investor@example.com"]);
    expect(lead?.consentStatus).toBe("confirmed");
  });
});

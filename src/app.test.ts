import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import type { LeadRepository } from "./repositories/lead-repository.js";

const repository: LeadRepository = {
  upsert: async () => { throw new Error("not used"); },
  list: async () => [],
  stats: async () => ({ total: 0, withContacts: 0, averageScore: 0, byPlatform: [] }),
};

describe("dashboard API", () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
  afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

  it("serves dashboard and protects statistics", async () => {
    const app = await buildApp(repository, { adminApiKey: "1234567890123456" });
    apps.push(app);
    expect((await app.inject({ method: "GET", url: "/dashboard" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/api/stats" })).statusCode).toBe(401);
    const response = await app.inject({ method: "GET", url: "/api/stats", headers: { "x-api-key": "1234567890123456" } });
    expect(response.json()).toMatchObject({ total: 0, withContacts: 0 });
  });

  it("serves a cache-busted dashboard.js that browsers can parse", async () => {
    const app = await buildApp(repository, { adminApiKey: "1234567890123456" });
    apps.push(app);
    const page = await app.inject({ method: "GET", url: "/dashboard" });
    const script = await app.inject({ method: "GET", url: "/dashboard.js" });
    expect(page.headers["cache-control"]).toBe("no-store");
    expect(script.headers["cache-control"]).toBe("no-store");
    expect(script.headers["content-type"]).toMatch(/javascript/);
    expect(page.body).toMatch(/\/dashboard\.js\?v=\d+/);
    expect(() => new Function(script.body)).not.toThrow();
    expect(script.body).not.toMatch(/split\(\/\n/);
  });

  it("exposes only health and webhooks on the public tunnel hostname", async () => {
    const app = await buildApp(repository, {
      adminApiKey: "1234567890123456",
      publicBaseUrl: "https://hooks.example.com",
    });
    apps.push(app);

    expect((await app.inject({ method: "GET", url: "/health", headers: { host: "hooks.example.com" } })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/dashboard", headers: { host: "hooks.example.com" } })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/dashboard", headers: { host: "127.0.0.1:8080" } })).statusCode).toBe(200);
  });

  it("keeps unconfigured public webhooks disabled", async () => {
    const app = await buildApp(repository, { adminApiKey: "1234567890123456" });
    apps.push(app);

    expect((await app.inject({ method: "POST", url: "/webhooks/telegram", payload: {} })).statusCode).toBe(503);
    expect((await app.inject({ method: "POST", url: "/webhooks/vk", payload: {} })).statusCode).toBe(503);
    expect((await app.inject({ method: "POST", url: "/webhooks/meta", payload: {} })).statusCode).toBe(503);
  });

  it("verifies VK and Meta setup challenges", async () => {
    const app = await buildApp(repository, {
      adminApiKey: "1234567890123456",
      vkSecret: "1234567890123456",
      vkConfirmationCode: "vk-code",
      metaVerifyToken: "abcdefghijklmnop",
    });
    apps.push(app);

    const vk = await app.inject({ method: "POST", url: "/webhooks/vk", payload: { type: "confirmation", secret: "1234567890123456" } });
    expect(vk.statusCode).toBe(200);
    expect(vk.body).toBe("vk-code");

    const meta = await app.inject({ method: "GET", url: "/webhooks/meta?hub.mode=subscribe&hub.verify_token=abcdefghijklmnop&hub.challenge=42" });
    expect(meta.statusCode).toBe(200);
    expect(meta.body).toBe("42");
  });
});

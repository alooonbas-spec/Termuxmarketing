import Fastify, { type FastifyInstance } from "fastify";
import helmet from "@fastify/helmet";
import rawBody from "fastify-raw-body";
import type { LeadRepository } from "./repositories/lead-repository.js";
import { TelegramConnector } from "./connectors/telegram.js";
import { VkConnector } from "./connectors/vk.js";
import { MetaConnector } from "./connectors/meta.js";
import { XConnector } from "./connectors/x.js";
import { RedditConnector } from "./connectors/reddit.js";
import { PinterestConnector } from "./connectors/pinterest.js";
import { LimitedPlatformConnector } from "./connectors/limited-platform.js";
import { constantTimeEqual, verifyMetaSignature } from "./security.js";
import { leadsToCsv } from "./services/csv-export.js";
import { dashboardCss, dashboardHtml, dashboardJs } from "./dashboard/assets.js";
import { z } from "zod";
import { platforms } from "./domain/lead.js";
import type { OutreachRepository } from "./outreach/outreach-repository.js";
import type { CommentService } from "./comments/comment-service.js";

export interface AppConfig {
  adminApiKey: string;
  publicBaseUrl?: string;
  vkSecret?: string;
  vkConfirmationCode?: string;
  telegramSecret?: string;
  metaVerifyToken?: string;
  metaAppSecret?: string;
}

export async function buildApp(repository: LeadRepository, config: AppConfig, outreach?: OutreachRepository, comments?: CommentService): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        // Панель /dashboard работает по обычному HTTP (127.0.0.1), и без явного
        // отключения этой директивы браузер молча апгрейдит запрос к /dashboard.js
        // на https:// — TLS-слушателя на этом порту нет, скрипт не загружается,
        // и страница выглядит так, будто JS вообще не запускается.
        "upgrade-insecure-requests": null,
      },
    },
  });
  await app.register(rawBody, { field: "rawBody", global: false, encoding: false, runFirst: true });
  const telegram = new TelegramConnector();
  const vk = new VkConnector();
  const instagram = new MetaConnector("instagram");
  const facebook = new MetaConnector("facebook");
  const pollingConnectors = {
    x: new XConnector(), reddit: new RedditConnector(), pinterest: new PinterestConnector(),
    linkedin: new LimitedPlatformConnector("linkedin"),
    dzen: new LimitedPlatformConnector("dzen"),
    quora: new LimitedPlatformConnector("quora"),
  } as const;
  const publicHostname = config.publicBaseUrl ? new URL(config.publicBaseUrl).hostname.toLowerCase() : undefined;

  app.addHook("onRequest", async (request, reply) => {
    if (!publicHostname || request.hostname.toLowerCase() !== publicHostname) return;
    const pathname = request.url.split("?", 1)[0];
    if (pathname === "/health" || pathname?.startsWith("/webhooks/")) return;
    return reply.code(404).send({ error: "not found" });
  });

  function isAdmin(apiKey: unknown): boolean {
    return constantTimeEqual(String(apiKey ?? ""), config.adminApiKey);
  }

  async function saveAll(candidates: ReturnType<typeof telegram.parse>) {
    return Promise.all(candidates.map((candidate) => repository.upsert(candidate)));
  }

  app.get("/health", async () => ({ status: "ok", version: "0.6.1", storage: process.env.STORAGE_DRIVER ?? "postgres" }));
  app.get("/dashboard", async (_request, reply) => reply.type("text/html; charset=utf-8").send(dashboardHtml));
  app.get("/dashboard.css", async (_request, reply) => reply.type("text/css; charset=utf-8").send(dashboardCss));
  app.get("/dashboard.js", async (_request, reply) => reply.type("application/javascript; charset=utf-8").send(dashboardJs));

  app.get("/api/leads", async (request, reply) => {
    if (!isAdmin(request.headers["x-api-key"])) return reply.code(401).send({ error: "unauthorized" });
    const query = request.query as { limit?: string; offset?: string };
    const limit = Math.min(Math.max(Number(query.limit ?? 50), 1), 200);
    const offset = Math.max(Number(query.offset ?? 0), 0);
    return { data: await repository.list(limit, offset), limit, offset };
  });

  app.get("/api/leads.csv", async (request, reply) => {
    if (!isAdmin(request.headers["x-api-key"])) return reply.code(401).send({ error: "unauthorized" });
    return reply.header("content-type", "text/csv; charset=utf-8")
      .header("content-disposition", "attachment; filename=leads.csv")
      .send(leadsToCsv(await repository.list(10_000, 0)));
  });

  app.get("/api/stats", async (request, reply) => {
    if (!isAdmin(request.headers["x-api-key"])) return reply.code(401).send({ error: "unauthorized" });
    return repository.stats();
  });

  if (outreach) {
    const platformSchema = z.enum(platforms);
    const templateSchema = z.object({ name: z.string().min(1).max(120), platform: z.union([platformSchema, z.literal("all")]),
      variants: z.array(z.string().min(1).max(4000)).min(1).max(10) });
    const campaignSchema = z.object({ name: z.string().min(1).max(120), templateId: z.string().uuid(),
      platforms: z.array(platformSchema).min(1), minimumScore: z.number().int().min(0).max(100).default(0),
      scheduledAt: z.coerce.date() });

    app.get("/api/outreach/templates", async (request, reply) => {
      if (!isAdmin(request.headers["x-api-key"])) return reply.code(401).send({ error: "unauthorized" });
      return { data: await outreach.listTemplates() };
    });
    app.post("/api/outreach/templates", async (request, reply) => {
      if (!isAdmin(request.headers["x-api-key"])) return reply.code(401).send({ error: "unauthorized" });
      const parsed = templateSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "invalid template", details: parsed.error.flatten() });
      return reply.code(201).send(await outreach.createTemplate(parsed.data));
    });
    app.post("/api/outreach/campaigns", async (request, reply) => {
      if (!isAdmin(request.headers["x-api-key"])) return reply.code(401).send({ error: "unauthorized" });
      const parsed = campaignSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "invalid campaign", details: parsed.error.flatten() });
      return reply.code(201).send(await outreach.createCampaign(parsed.data));
    });
    app.post<{ Params: { id: string } }>("/api/outreach/campaigns/:id/launch", async (request, reply) => {
      if (!isAdmin(request.headers["x-api-key"])) return reply.code(401).send({ error: "unauthorized" });
      return outreach.launchCampaign(request.params.id);
    });
    app.post("/api/outreach/suppress", async (request, reply) => {
      if (!isAdmin(request.headers["x-api-key"])) return reply.code(401).send({ error: "unauthorized" });
      const parsed = z.object({ platform: platformSchema, platformUserId: z.string().min(1), reason: z.string().min(1).max(500) }).safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "invalid suppression" });
      await outreach.suppress(parsed.data.platform, parsed.data.platformUserId, parsed.data.reason);
      return { ok: true };
    });
  }

  if (comments) {
    const draftSchema = z.object({
      accountId: z.string().min(1).max(50), targetUrl: z.string().url().max(500), text: z.string().min(1).max(4096),
    });
    app.get("/api/comments/accounts", async (request, reply) => {
      if (!isAdmin(request.headers["x-api-key"])) return reply.code(401).send({ error: "unauthorized" });
      return { data: comments.listAccounts() };
    });
    app.get("/api/comments", async (request, reply) => {
      if (!isAdmin(request.headers["x-api-key"])) return reply.code(401).send({ error: "unauthorized" });
      return { data: await comments.list(100) };
    });
    app.post("/api/comments/drafts", async (request, reply) => {
      if (!isAdmin(request.headers["x-api-key"])) return reply.code(401).send({ error: "unauthorized" });
      const parsed = draftSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "Некорректный черновик", details: parsed.error.flatten() });
      try { return reply.code(201).send(await comments.createDraft(parsed.data)); }
      catch (error) { return reply.code(400).send({ error: error instanceof Error ? error.message : "Не удалось создать черновик" }); }
    });
    app.post<{ Params: { id: string } }>("/api/comments/:id/publish", async (request, reply) => {
      if (!isAdmin(request.headers["x-api-key"])) return reply.code(401).send({ error: "unauthorized" });
      const parsed = z.object({ confirmation: z.literal("PUBLISH") }).safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "Требуется подтверждение PUBLISH" });
      try { return await comments.publish(request.params.id, parsed.data.confirmation); }
      catch (error) { return reply.code(400).send({ error: error instanceof Error ? error.message : "Ошибка публикации" }); }
    });
  }

  app.post<{ Params: { platform: keyof typeof pollingConnectors } }>("/api/ingest/:platform", async (request, reply) => {
    if (!isAdmin(request.headers["x-api-key"])) return reply.code(401).send({ error: "unauthorized" });
    const connector = pollingConnectors[request.params.platform];
    if (!connector) return reply.code(404).send({ error: "unsupported platform" });
    const leads = await saveAll(connector.parse(request.body));
    return { ok: true, platform: request.params.platform, accepted: leads.length };
  });

  app.post("/webhooks/telegram", async (request, reply) => {
    if (!config.telegramSecret) return reply.code(503).send({ error: "telegram webhook is not configured" });
    const actual = String(request.headers["x-telegram-bot-api-secret-token"] ?? "");
    if (!constantTimeEqual(actual, config.telegramSecret)) return reply.code(401).send({ error: "invalid secret" });
    const leads = await saveAll(telegram.parse(request.body));
    return { ok: true, accepted: leads.length };
  });

  app.post("/webhooks/vk", async (request, reply) => {
    const body = request.body as { type?: string; secret?: string };
    if (!config.vkSecret) return reply.code(503).send("vk webhook is not configured");
    if (!constantTimeEqual(body.secret ?? "", config.vkSecret)) {
      return reply.code(401).send("invalid secret");
    }
    if (body.type === "confirmation") {
      if (!config.vkConfirmationCode) return reply.code(503).send("vk confirmation code is not configured");
      return reply.type("text/plain").send(config.vkConfirmationCode);
    }
    await saveAll(vk.parse(body));
    return reply.type("text/plain").send("ok");
  });

  app.get("/webhooks/meta", async (request, reply) => {
    if (!config.metaVerifyToken) return reply.code(503).send("meta webhook is not configured");
    const query = request.query as Record<string, string>;
    if (query["hub.mode"] === "subscribe" && query["hub.verify_token"] === config.metaVerifyToken) {
      return reply.type("text/plain").send(query["hub.challenge"] ?? "");
    }
    return reply.code(403).send("verification failed");
  });

  app.post("/webhooks/meta", { config: { rawBody: true } }, async (request, reply) => {
    if (!config.metaAppSecret) return reply.code(503).send({ error: "meta webhook is not configured" });
    const signature = String(request.headers["x-hub-signature-256"] ?? "");
    const raw = request.rawBody;
    if (!Buffer.isBuffer(raw)) return reply.code(400).send({ error: "raw body unavailable" });
    if (!verifyMetaSignature(raw, signature, config.metaAppSecret)) return reply.code(401).send({ error: "invalid signature" });
    const body = request.body as { object?: string };
    const connector = body.object === "instagram" ? instagram : facebook;
    const leads = await saveAll(connector.parse(body));
    return { ok: true, accepted: leads.length };
  });

  return app;
}

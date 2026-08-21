import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JsonCommentRepository } from "../comments/json-comment-repository.js";
import { JsonDeliveryQueue } from "../crm/json-delivery-queue.js";
import type { LeadCandidate } from "../domain/lead.js";
import { JsonMessageQueue } from "../outreach/json-message-queue.js";
import { JsonOutreachRepository } from "../outreach/json-outreach-repository.js";
import { JsonLeadRepository } from "../repositories/json-lead-repository.js";
import { JsonDatabase } from "./json-database.js";

function candidate(sourceId: string): LeadCandidate {
  return {
    platform: "vk",
    platformUserId: "12345",
    username: "max_test",
    displayName: "Максим Тест",
    profileUrl: "https://vk.com/max_test",
    sourceType: "message",
    sourceId,
    sourceText: "Напишите на test@example.com",
    consentStatus: "confirmed",
    contacts: { phones: [], emails: ["test@example.com"], telegram: [], urls: [] },
    rawEvent: { id: sourceId },
    collectedAt: new Date("2026-08-04T10:00:00.000Z"),
  };
}

describe("JSON storage for the Termux edition", () => {
  let directory: string;
  let filePath: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "social-collector-json-"));
    filePath = join(directory, "collector.json");
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("persists leads and statistics across restarts", async () => {
    const firstDatabase = new JsonDatabase(filePath);
    await firstDatabase.initialize();
    const firstRepository = new JsonLeadRepository(firstDatabase);
    const lead = await firstRepository.upsert(candidate("message-1"));
    expect(lead.displayName).toBe("Максим Тест");
    expect((await firstRepository.stats()).withContacts).toBe(1);
    await firstDatabase.close();

    const secondDatabase = new JsonDatabase(filePath);
    await secondDatabase.initialize();
    const restored = await new JsonLeadRepository(secondDatabase).list(10, 0);
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({ id: lead.id, platform: "vk", score: lead.score });
    expect(restored[0]?.collectedAt).toBeInstanceOf(Date);
  });

  it("stores comment drafts, duplicate checks and publication state", async () => {
    const database = new JsonDatabase(filePath);
    await database.initialize();
    const comments = new JsonCommentRepository(database);
    const draft = await comments.createDraft({
      accountId: "main",
      accountLabel: "Основной VK",
      targetUrl: "https://vk.com/wall-1_2",
      canonicalUrl: "https://vk.com/wall-1_2",
      ownerId: -1,
      postId: 2,
      text: "Тестовый комментарий",
    });
    expect(await comments.hasRecentDuplicate("main", -1, 2, "Тестовый комментарий")).toBe(true);
    const published = await comments.markPublished(draft.id, "77", "https://vk.com/wall-1_2?reply=77");
    expect(published.status).toBe("published");
    expect(await comments.countPublishedToday("main")).toBe(1);
  });

  it("queues campaigns and CRM delivery jobs without PostgreSQL", async () => {
    const database = new JsonDatabase(filePath);
    await database.initialize();
    const leads = new JsonLeadRepository(database);
    await leads.upsert(candidate("message-2"));

    const outreach = new JsonOutreachRepository(database);
    const template = await outreach.createTemplate({
      name: "Приветствие",
      platform: "vk",
      variants: ["Здравствуйте, {{firstName}}!"],
    });
    const campaign = await outreach.createCampaign({
      name: "Кампания VK",
      templateId: template.id,
      platforms: ["vk"],
      minimumScore: 0,
      scheduledAt: new Date("2026-08-04T09:00:00.000Z"),
    });
    await expect(outreach.launchCampaign(campaign.id)).resolves.toEqual({ queued: 1, skipped: 0 });

    const messages = new JsonMessageQueue(database);
    const jobs = await messages.claim(10);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.renderedText).toBe("Здравствуйте, Максим!");
    await messages.sent(jobs[0]!.id, "provider-1");

    const deliveries = new JsonDeliveryQueue(database);
    const crmJobs = await deliveries.claim(10);
    expect(crmJobs).toHaveLength(1);
    await deliveries.complete(crmJobs[0]!.id);
  });
});

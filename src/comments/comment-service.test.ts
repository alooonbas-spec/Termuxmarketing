import { describe, expect, it } from "vitest";
import type { CommentRepository } from "./comment-repository.js";
import { CommentService } from "./comment-service.js";
import type { CommentDraft } from "./types.js";
import { VkCommentPublisher } from "./vk-comment-publisher.js";

const base: CommentDraft = { id: "draft-1", platform: "vk", accountId: "main", accountLabel: "Основной", targetUrl: "https://vk.com/wall-1_2", ownerId: -1, postId: 2, text: "Здравствуйте", status: "draft", createdAt: new Date() };

function fakeRepository(): CommentRepository {
  let draft = base;
  return {
    createDraft: async (input) => (draft = { ...base, ...input, targetUrl: input.canonicalUrl }),
    get: async () => draft,
    list: async () => [draft],
    countPublishedToday: async () => 0,
    hasRecentDuplicate: async () => false,
    markPublished: async (_id, providerCommentId, providerUrl) => (draft = { ...draft, status: "published", providerCommentId, providerUrl }),
    markFailed: async (_id, lastError) => (draft = { ...draft, status: "failed", lastError }),
  };
}

describe("CommentService", () => {
  it("requires a separate explicit publish confirmation", async () => {
    const publisher = { publish: async () => ({ commentId: "3", url: "https://vk.com/wall-1_2?reply=3" }) } as VkCommentPublisher;
    const service = new CommentService(fakeRepository(), [{ id: "main", label: "Основной", token: "secret-token", dailyLimit: 10 }], publisher);
    await expect(service.publish("draft-1", "yes")).rejects.toThrow("подтверждение");
    await expect(service.publish("draft-1", "PUBLISH")).resolves.toMatchObject({ status: "published", providerCommentId: "3" });
  });
});

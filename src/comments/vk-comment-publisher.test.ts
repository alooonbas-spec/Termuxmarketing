import { describe, expect, it, vi } from "vitest";
import { parseVkPostUrl, VkCommentPublisher } from "./vk-comment-publisher.js";

describe("VK comment publisher", () => {
  it("parses common VK post links", () => {
    expect(parseVkPostUrl("https://vk.com/wall-123_456")).toEqual({ ownerId: -123, postId: 456, canonicalUrl: "https://vk.com/wall-123_456" });
    expect(parseVkPostUrl("https://m.vk.com/feed?w=wall77_99")).toMatchObject({ ownerId: 77, postId: 99 });
  });

  it("rejects non-VK hosts", () => {
    expect(() => parseVkPostUrl("https://example.com/wall-123_456")).toThrow("vk.com");
  });

  it("publishes using wall.createComment without exposing the token", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(String(_url)).toContain("wall.createComment");
      const params = init?.body as URLSearchParams;
      expect(params.get("owner_id")).toBe("-123");
      expect(params.get("post_id")).toBe("456");
      expect(params.get("message")).toBe("Тест");
      return new Response(JSON.stringify({ response: { comment_id: 789 } }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const publisher = new VkCommentPublisher("5.199", fetchMock as typeof fetch);
    await expect(publisher.publish({ id: "main", label: "Основной", token: "secret-token", dailyLimit: 10 },
      { ownerId: -123, postId: 456, canonicalUrl: "https://vk.com/wall-123_456" }, "Тест"))
      .resolves.toEqual({ commentId: "789", url: "https://vk.com/wall-123_456?reply=789" });
  });
});

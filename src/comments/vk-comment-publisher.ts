import type { CommentAccount } from "./types.js";

export interface VkPostTarget { ownerId: number; postId: number; canonicalUrl: string }
export interface PublishedVkComment { commentId: string; url: string }

export function parseVkPostUrl(value: string): VkPostTarget {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Некорректная ссылка VK"); }
  if (!["vk.com", "www.vk.com", "m.vk.com"].includes(url.hostname.toLowerCase())) {
    throw new Error("Разрешены только ссылки vk.com");
  }
  const source = `${url.pathname}${url.search}${url.hash}`;
  const match = source.match(/wall(-?\d+)_(\d+)/i);
  if (!match) throw new Error("Не удалось определить запись. Нужна ссылка вида https://vk.com/wall-123_456");
  const ownerId = Number(match[1]);
  const postId = Number(match[2]);
  if (!Number.isSafeInteger(ownerId) || !Number.isSafeInteger(postId) || postId <= 0) throw new Error("Некорректный ID записи VK");
  return { ownerId, postId, canonicalUrl: `https://vk.com/wall${ownerId}_${postId}` };
}

async function expectVkJson(response: Response): Promise<Record<string, unknown>> {
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok || body.error) {
    const error = body.error as { error_msg?: string; error_code?: number } | undefined;
    throw new Error(error?.error_msg ? `VK ${error.error_code ?? ""}: ${error.error_msg}` : `VK HTTP ${response.status}`);
  }
  return body;
}

export class VkCommentPublisher {
  constructor(private readonly apiVersion: string, private readonly fetchImpl: typeof fetch = fetch) {}

  async publish(account: CommentAccount, target: VkPostTarget, text: string): Promise<PublishedVkComment> {
    const params = new URLSearchParams({
      owner_id: String(target.ownerId), post_id: String(target.postId), message: text,
      from_group: "0", access_token: account.token, v: this.apiVersion,
    });
    const body = await expectVkJson(await this.fetchImpl("https://api.vk.com/method/wall.createComment", {
      method: "POST", body: params, signal: AbortSignal.timeout(15_000),
    }));
    const response = body.response as { comment_id?: number } | undefined;
    if (!response?.comment_id) throw new Error("VK не вернул ID комментария");
    const commentId = String(response.comment_id);
    return { commentId, url: `${target.canonicalUrl}?reply=${commentId}` };
  }
}

import type { CommentRepository } from "./comment-repository.js";
import type { CommentAccount, CommentDraft, CreateCommentDraftInput } from "./types.js";
import { parseVkPostUrl, VkCommentPublisher } from "./vk-comment-publisher.js";

export class CommentService {
  private readonly accounts: Map<string, CommentAccount>;
  constructor(private readonly repository: CommentRepository, accounts: CommentAccount[], private readonly publisher: VkCommentPublisher) {
    this.accounts = new Map(accounts.map((account) => [account.id, account]));
  }
  listAccounts(): Array<Omit<CommentAccount, "token">> { return [...this.accounts.values()].map(({ token: _token, ...safe }) => safe); }
  list(limit?: number): Promise<CommentDraft[]> { return this.repository.list(limit); }

  async createDraft(input: CreateCommentDraftInput): Promise<CommentDraft> {
    const account = this.accounts.get(input.accountId);
    if (!account) throw new Error("Аккаунт VK не найден или не настроен");
    const text = input.text.trim();
    if (!text || text.length > 4096) throw new Error("Комментарий должен содержать от 1 до 4096 символов");
    const target = parseVkPostUrl(input.targetUrl);
    if (await this.repository.hasRecentDuplicate(account.id, target.ownerId, target.postId, text)) throw new Error("Такой комментарий уже создавался для этой записи за последние 24 часа");
    return this.repository.createDraft({ ...input, text, accountLabel: account.label, ownerId: target.ownerId, postId: target.postId, canonicalUrl: target.canonicalUrl });
  }

  async publish(id: string, confirmation: string): Promise<CommentDraft> {
    if (confirmation !== "PUBLISH") throw new Error("Требуется явное подтверждение публикации");
    const draft = await this.repository.get(id);
    if (!draft) throw new Error("Черновик не найден");
    if (draft.status !== "draft") throw new Error("Опубликовать можно только черновик");
    const account = this.accounts.get(draft.accountId);
    if (!account) throw new Error("Аккаунт VK больше не настроен");
    const used = await this.repository.countPublishedToday(account.id);
    if (used >= account.dailyLimit) throw new Error(`Дневной лимит аккаунта исчерпан (${account.dailyLimit})`);
    try {
      const target = { ownerId: draft.ownerId, postId: draft.postId, canonicalUrl: draft.targetUrl };
      const result = await this.publisher.publish(account, target, draft.text);
      return this.repository.markPublished(id, result.commentId, result.url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Неизвестная ошибка публикации";
      await this.repository.markFailed(id, message);
      throw error;
    }
  }
}

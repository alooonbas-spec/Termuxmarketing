import { randomUUID } from "node:crypto";
import type { JsonDatabase, StoredCommentPublication } from "../storage/json-database.js";
import type { CommentRepository } from "./comment-repository.js";
import type { CommentDraft, CreateCommentDraftInput } from "./types.js";

function toDraft(stored: StoredCommentPublication): CommentDraft {
  const { createdAt, publishedAt, ...rest } = structuredClone(stored);
  return {
    ...rest,
    createdAt: new Date(createdAt),
    ...(publishedAt !== undefined ? { publishedAt: new Date(publishedAt) } : {}),
  };
}

function localStartOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

export class JsonCommentRepository implements CommentRepository {
  constructor(private readonly database: JsonDatabase) {}

  async createDraft(input: CreateCommentDraftInput & { accountLabel: string; ownerId: number; postId: number; canonicalUrl: string }): Promise<CommentDraft> {
    return this.database.transaction((state) => {
      const publication: StoredCommentPublication = {
        id: randomUUID(),
        platform: "vk",
        accountId: input.accountId,
        accountLabel: input.accountLabel,
        targetUrl: input.canonicalUrl,
        ownerId: input.ownerId,
        postId: input.postId,
        text: input.text,
        status: "draft",
        createdAt: new Date().toISOString(),
      };
      state.commentPublications.push(publication);
      return toDraft(publication);
    });
  }

  async get(id: string): Promise<CommentDraft | undefined> {
    return this.database.query((state) => {
      const publication = state.commentPublications.find((item) => item.id === id);
      return publication ? toDraft(publication) : undefined;
    });
  }

  async list(limit = 100): Promise<CommentDraft[]> {
    return this.database.query((state) => [...state.commentPublications]
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, limit)
      .map(toDraft));
  }

  async countPublishedToday(accountId: string): Promise<number> {
    const start = localStartOfToday();
    return this.database.query((state) => state.commentPublications.filter((item) =>
      item.accountId === accountId
      && item.status === "published"
      && item.publishedAt !== undefined
      && Date.parse(item.publishedAt) >= start).length);
  }

  async hasRecentDuplicate(accountId: string, ownerId: number, postId: number, text: string): Promise<boolean> {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return this.database.query((state) => state.commentPublications.some((item) =>
      item.accountId === accountId
      && item.ownerId === ownerId
      && item.postId === postId
      && item.text === text
      && (item.status === "draft" || item.status === "published")
      && Date.parse(item.createdAt) > cutoff));
  }

  async markPublished(id: string, commentId: string, providerUrl: string): Promise<CommentDraft> {
    return this.database.transaction((state) => {
      const publication = state.commentPublications.find((item) => item.id === id);
      if (!publication) throw new Error("Черновик комментария не найден");
      publication.status = "published";
      publication.providerCommentId = commentId;
      publication.providerUrl = providerUrl;
      publication.publishedAt = new Date().toISOString();
      delete publication.lastError;
      return toDraft(publication);
    });
  }

  async markFailed(id: string, message: string): Promise<CommentDraft> {
    return this.database.transaction((state) => {
      const publication = state.commentPublications.find((item) => item.id === id);
      if (!publication) throw new Error("Черновик комментария не найден");
      publication.status = "failed";
      publication.lastError = message.slice(0, 1000);
      return toDraft(publication);
    });
  }
}

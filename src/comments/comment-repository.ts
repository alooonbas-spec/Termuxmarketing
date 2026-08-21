import type { CommentDraft, CreateCommentDraftInput } from "./types.js";

export interface CommentRepository {
  createDraft(input: CreateCommentDraftInput & { accountLabel: string; ownerId: number; postId: number; canonicalUrl: string }): Promise<CommentDraft>;
  get(id: string): Promise<CommentDraft | undefined>;
  list(limit?: number): Promise<CommentDraft[]>;
  countPublishedToday(accountId: string): Promise<number>;
  hasRecentDuplicate(accountId: string, ownerId: number, postId: number, text: string): Promise<boolean>;
  markPublished(id: string, commentId: string, providerUrl: string): Promise<CommentDraft>;
  markFailed(id: string, message: string): Promise<CommentDraft>;
}

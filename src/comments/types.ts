export interface CommentAccount {
  id: string;
  label: string;
  token: string;
  dailyLimit: number;
}

export interface CommentDraft {
  id: string;
  platform: "vk";
  accountId: string;
  accountLabel: string;
  targetUrl: string;
  ownerId: number;
  postId: number;
  text: string;
  status: "draft" | "published" | "failed";
  providerCommentId?: string;
  providerUrl?: string;
  lastError?: string;
  createdAt: Date;
  publishedAt?: Date;
}

export interface CreateCommentDraftInput {
  accountId: string;
  targetUrl: string;
  text: string;
}

import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { CommentRepository } from "./comment-repository.js";
import type { CommentDraft, CreateCommentDraftInput } from "./types.js";

const columns = `id,platform,account_id AS "accountId",account_label AS "accountLabel",target_url AS "targetUrl",
 owner_id AS "ownerId",post_id AS "postId",text,status,provider_comment_id AS "providerCommentId",
 provider_url AS "providerUrl",last_error AS "lastError",created_at AS "createdAt",published_at AS "publishedAt"`;
const select = `SELECT ${columns} FROM comment_publications`;

export class PostgresCommentRepository implements CommentRepository {
  constructor(private readonly pool: Pool) {}

  async createDraft(input: CreateCommentDraftInput & { accountLabel: string; ownerId: number; postId: number; canonicalUrl: string }): Promise<CommentDraft> {
    return (await this.pool.query<CommentDraft>(`INSERT INTO comment_publications(id,platform,account_id,account_label,target_url,owner_id,post_id,text)
      VALUES($1,'vk',$2,$3,$4,$5,$6,$7) RETURNING ${columns}`,
      [randomUUID(), input.accountId, input.accountLabel, input.canonicalUrl, input.ownerId, input.postId, input.text])).rows[0]!;
  }
  async get(id: string): Promise<CommentDraft | undefined> { return (await this.pool.query<CommentDraft>(`${select} WHERE id=$1`, [id])).rows[0]; }
  async list(limit = 100): Promise<CommentDraft[]> { return (await this.pool.query<CommentDraft>(`${select} ORDER BY created_at DESC LIMIT $1`, [limit])).rows; }
  async countPublishedToday(accountId: string): Promise<number> {
    return Number((await this.pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM comment_publications WHERE account_id=$1 AND status='published' AND published_at >= date_trunc('day',NOW())`, [accountId])).rows[0]?.count ?? 0);
  }
  async hasRecentDuplicate(accountId: string, ownerId: number, postId: number, text: string): Promise<boolean> {
    const result = await this.pool.query(`SELECT 1 FROM comment_publications WHERE account_id=$1 AND owner_id=$2 AND post_id=$3 AND text=$4 AND status IN ('draft','published') AND created_at > NOW()-INTERVAL '24 hours' LIMIT 1`, [accountId, ownerId, postId, text]);
    return Boolean(result.rowCount);
  }
  async markPublished(id: string, commentId: string, providerUrl: string): Promise<CommentDraft> {
    return (await this.pool.query<CommentDraft>(`UPDATE comment_publications SET status='published',provider_comment_id=$2,provider_url=$3,published_at=NOW(),last_error=NULL WHERE id=$1 RETURNING ${columns}`, [id, commentId, providerUrl])).rows[0]!;
  }
  async markFailed(id: string, message: string): Promise<CommentDraft> {
    return (await this.pool.query<CommentDraft>(`UPDATE comment_publications SET status='failed',last_error=$2 WHERE id=$1 RETURNING ${columns}`, [id, message.slice(0, 1000)])).rows[0]!;
  }
}

export async function initializeCommentSchema(pool: Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS comment_publications (
    id UUID PRIMARY KEY, platform TEXT NOT NULL CHECK(platform='vk'), account_id TEXT NOT NULL, account_label TEXT NOT NULL,
    target_url TEXT NOT NULL, owner_id BIGINT NOT NULL, post_id BIGINT NOT NULL, text TEXT NOT NULL CHECK(char_length(text) BETWEEN 1 AND 4096),
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','failed')), provider_comment_id TEXT, provider_url TEXT,
    last_error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), published_at TIMESTAMPTZ
  ); CREATE INDEX IF NOT EXISTS comment_publications_account_day_idx ON comment_publications(account_id,published_at DESC);
  CREATE INDEX IF NOT EXISTS comment_publications_target_idx ON comment_publications(owner_id,post_id,created_at DESC);`);
}

import type { Pool } from "pg";
import type { OutreachJob, OutreachQueue } from "./message-queue.js";

export class PostgresMessageQueue implements OutreachQueue {
  constructor(private readonly pool: Pool) {}
  async claim(limit: number): Promise<OutreachJob[]> {
    return (await this.pool.query<OutreachJob>(
      `WITH selected AS (SELECT id FROM outreach_messages WHERE status IN ('pending','retry') AND scheduled_at<=NOW() AND available_at<=NOW()
       ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT $1)
       UPDATE outreach_messages m SET status='processing',attempts=attempts+1,updated_at=NOW() FROM selected WHERE m.id=selected.id
       RETURNING m.id,m.platform,m.platform_user_id AS "platformUserId",m.rendered_text AS "renderedText",m.attempts`, [limit])).rows;
  }
  async sent(id: string, providerMessageId?: string): Promise<void> {
    await this.pool.query("UPDATE outreach_messages SET status='sent',provider_message_id=$2,sent_at=NOW(),updated_at=NOW() WHERE id=$1", [id, providerMessageId ?? null]);
  }
  async retry(id: string, error: string, delaySeconds: number): Promise<void> {
    await this.pool.query("UPDATE outreach_messages SET status=CASE WHEN attempts>=6 THEN 'failed' ELSE 'retry' END,last_error=$2,available_at=NOW()+($3*INTERVAL '1 second'),updated_at=NOW() WHERE id=$1", [id, error.slice(0,2000), delaySeconds]);
  }
  async manualReview(id: string, reason: string): Promise<void> {
    await this.pool.query("UPDATE outreach_messages SET status='manual_review',last_error=$2,updated_at=NOW() WHERE id=$1", [id, reason]);
  }
}

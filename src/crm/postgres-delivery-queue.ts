import type { Pool } from "pg";
import type { DeliveryJob, DeliveryQueue } from "./delivery-queue.js";

export class PostgresDeliveryQueue implements DeliveryQueue {
  constructor(private readonly pool: Pool) {}

  async claim(limit: number): Promise<DeliveryJob[]> {
    const result = await this.pool.query<DeliveryJob>(
      `WITH selected AS (
         SELECT id FROM crm_outbox
         WHERE status IN ('pending', 'retry') AND available_at <= NOW()
         ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT $1
       )
       UPDATE crm_outbox q SET status = 'processing', attempts = attempts + 1, updated_at = NOW()
       FROM selected WHERE q.id = selected.id
       RETURNING q.id, q.payload, q.attempts`,
      [limit],
    );
    return result.rows;
  }

  async complete(id: string): Promise<void> {
    await this.pool.query("UPDATE crm_outbox SET status='sent', sent_at=NOW(), updated_at=NOW() WHERE id=$1", [id]);
  }

  async retry(id: string, error: string, delaySeconds: number): Promise<void> {
    await this.pool.query(
      "UPDATE crm_outbox SET status=CASE WHEN attempts >= 10 THEN 'failed' ELSE 'retry' END, last_error=$2, available_at=NOW()+($3*INTERVAL '1 second'), updated_at=NOW() WHERE id=$1",
      [id, error.slice(0, 2000), delaySeconds],
    );
  }
}

import { createHmac } from "node:crypto";
import type { DeliveryQueue } from "./delivery-queue.js";

export interface CrmWorkerOptions {
  webhookUrl: string;
  secret: string;
  batchSize?: number;
  fetchImpl?: typeof fetch;
}

export class CrmWorker {
  private readonly fetchImpl: typeof fetch;
  constructor(private readonly queue: DeliveryQueue, private readonly options: CrmWorkerOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async runOnce(): Promise<{ sent: number; failed: number }> {
    const jobs = await this.queue.claim(this.options.batchSize ?? 25);
    let sent = 0;
    let failed = 0;
    for (const job of jobs) {
      const body = JSON.stringify({ event: "lead.upserted", data: job.payload });
      const signature = createHmac("sha256", this.options.secret).update(body).digest("hex");
      try {
        const response = await this.fetchImpl(this.options.webhookUrl, {
          method: "POST",
          headers: { "content-type": "application/json", "x-collector-signature": `sha256=${signature}`, "x-idempotency-key": job.id },
          body,
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new Error(`CRM responded with HTTP ${response.status}`);
        await this.queue.complete(job.id);
        sent += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown CRM delivery error";
        const delay = Math.min(3600, 2 ** Math.min(job.attempts, 10) * 5);
        await this.queue.retry(job.id, message, delay);
        failed += 1;
      }
    }
    return { sent, failed };
  }
}

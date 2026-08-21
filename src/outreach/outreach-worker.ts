import type { OutreachQueue } from "./message-queue.js";
import type { SenderRegistry } from "./platform-senders.js";

export class OutreachWorker {
  constructor(private readonly queue: OutreachQueue, private readonly senders: SenderRegistry) {}
  async runOnce(): Promise<{ sent: number; retry: number; manualReview: number }> {
    const jobs = await this.queue.claim(25); let sent=0,retry=0,manualReview=0;
    for (const job of jobs) {
      const sender = this.senders[job.platform];
      if (!sender) { await this.queue.manualReview(job.id, `Automatic messaging is not configured or allowed for ${job.platform}`); manualReview++; continue; }
      try { const result = await sender.send(job.platformUserId, job.renderedText); await this.queue.sent(job.id, result.providerMessageId); sent++; }
      catch (error) { const message=error instanceof Error?error.message:"Unknown provider error"; await this.queue.retry(job.id,message,Math.min(3600,2**job.attempts*10)); retry++; }
    }
    return { sent,retry,manualReview };
  }
}

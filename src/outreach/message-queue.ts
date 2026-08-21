import type { Platform } from "../domain/lead.js";

export interface OutreachJob { id: string; platform: Platform; platformUserId: string; renderedText: string; attempts: number }
export interface OutreachQueue {
  claim(limit: number): Promise<OutreachJob[]>;
  sent(id: string, providerMessageId?: string): Promise<void>;
  retry(id: string, error: string, delaySeconds: number): Promise<void>;
  manualReview(id: string, reason: string): Promise<void>;
}

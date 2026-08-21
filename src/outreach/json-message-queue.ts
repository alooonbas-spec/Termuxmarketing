import type { JsonDatabase } from "../storage/json-database.js";
import type { OutreachJob, OutreachQueue } from "./message-queue.js";

export class JsonMessageQueue implements OutreachQueue {
  constructor(private readonly database: JsonDatabase) {}

  async claim(limit: number): Promise<OutreachJob[]> {
    return this.database.transaction((state) => {
      const now = Date.now();
      const selected = state.outreachMessages
        .filter((message) =>
          (message.status === "pending" || message.status === "retry")
          && Date.parse(message.scheduledAt) <= now
          && Date.parse(message.availableAt) <= now)
        .sort((left, right) => Date.parse(left.availableAt) - Date.parse(right.availableAt))
        .slice(0, limit);
      const changedAt = new Date().toISOString();
      for (const message of selected) {
        message.status = "processing";
        message.attempts += 1;
        message.updatedAt = changedAt;
      }
      return selected.map((message) => ({
        id: message.id,
        platform: message.platform,
        platformUserId: message.platformUserId,
        renderedText: message.renderedText,
        attempts: message.attempts,
      }));
    });
  }

  async sent(id: string, providerMessageId?: string): Promise<void> {
    await this.database.transaction((state) => {
      const message = state.outreachMessages.find((item) => item.id === id);
      if (!message) throw new Error("Outreach message not found");
      message.status = "sent";
      if (providerMessageId !== undefined) message.providerMessageId = providerMessageId;
      message.sentAt = new Date().toISOString();
      message.updatedAt = message.sentAt;
      delete message.lastError;
    });
  }

  async retry(id: string, error: string, delaySeconds: number): Promise<void> {
    await this.database.transaction((state) => {
      const message = state.outreachMessages.find((item) => item.id === id);
      if (!message) throw new Error("Outreach message not found");
      message.status = message.attempts >= 6 ? "failed" : "retry";
      message.lastError = error.slice(0, 2000);
      message.availableAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
      message.updatedAt = new Date().toISOString();
    });
  }

  async manualReview(id: string, reason: string): Promise<void> {
    await this.database.transaction((state) => {
      const message = state.outreachMessages.find((item) => item.id === id);
      if (!message) throw new Error("Outreach message not found");
      message.status = "manual_review";
      message.lastError = reason;
      message.updatedAt = new Date().toISOString();
    });
  }
}

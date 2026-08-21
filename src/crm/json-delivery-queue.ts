import type { JsonDatabase } from "../storage/json-database.js";
import type { DeliveryJob, DeliveryQueue } from "./delivery-queue.js";

export class JsonDeliveryQueue implements DeliveryQueue {
  constructor(private readonly database: JsonDatabase) {}

  async claim(limit: number): Promise<DeliveryJob[]> {
    return this.database.transaction((state) => {
      const now = Date.now();
      const selected = state.crmOutbox
        .filter((item) => (item.status === "pending" || item.status === "retry") && Date.parse(item.availableAt) <= now)
        .sort((left, right) => Date.parse(left.availableAt) - Date.parse(right.availableAt))
        .slice(0, limit);
      const changedAt = new Date().toISOString();
      for (const item of selected) {
        item.status = "processing";
        item.attempts += 1;
        item.updatedAt = changedAt;
      }
      return selected.map((item) => ({ id: item.id, payload: structuredClone(item.payload), attempts: item.attempts }));
    });
  }

  async complete(id: string): Promise<void> {
    await this.database.transaction((state) => {
      const item = state.crmOutbox.find((entry) => entry.id === id);
      if (!item) throw new Error("CRM delivery job not found");
      item.status = "sent";
      item.sentAt = new Date().toISOString();
      item.updatedAt = item.sentAt;
      delete item.lastError;
    });
  }

  async retry(id: string, error: string, delaySeconds: number): Promise<void> {
    await this.database.transaction((state) => {
      const item = state.crmOutbox.find((entry) => entry.id === id);
      if (!item) throw new Error("CRM delivery job not found");
      item.status = item.attempts >= 10 ? "failed" : "retry";
      item.lastError = error.slice(0, 2000);
      item.availableAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
      item.updatedAt = new Date().toISOString();
    });
  }
}

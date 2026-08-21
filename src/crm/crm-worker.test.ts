import { describe, expect, it, vi } from "vitest";
import { CrmWorker } from "./crm-worker.js";
import type { DeliveryQueue } from "./delivery-queue.js";

function queue(): DeliveryQueue {
  return { claim: vi.fn().mockResolvedValue([{ id: "job-1", payload: { id: "lead-1" }, attempts: 1 }]),
    complete: vi.fn().mockResolvedValue(undefined), retry: vi.fn().mockResolvedValue(undefined) };
}

describe("CRM worker", () => {
  it("signs and completes successful deliveries", async () => {
    const deliveryQueue = queue();
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const result = await new CrmWorker(deliveryQueue, { webhookUrl: "https://crm.example/webhook", secret: "1234567890123456", fetchImpl }).runOnce();
    expect(result).toEqual({ sent: 1, failed: 0 });
    expect(deliveryQueue.complete).toHaveBeenCalledWith("job-1");
    expect(fetchImpl.mock.calls[0]?.[1]?.headers).toHaveProperty("x-collector-signature");
  });

  it("schedules retry after HTTP errors", async () => {
    const deliveryQueue = queue();
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    const result = await new CrmWorker(deliveryQueue, { webhookUrl: "https://crm.example/webhook", secret: "1234567890123456", fetchImpl }).runOnce();
    expect(result).toEqual({ sent: 0, failed: 1 });
    expect(deliveryQueue.retry).toHaveBeenCalled();
  });
});

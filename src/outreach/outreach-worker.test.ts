import { describe, expect, it, vi } from "vitest";
import type { OutreachQueue } from "./message-queue.js";
import { OutreachWorker } from "./outreach-worker.js";

function queue(platform: "telegram" | "linkedin"): OutreachQueue {
  return { claim: vi.fn().mockResolvedValue([{ id:"1",platform,platformUserId:"7",renderedText:"Hello",attempts:1 }]),
    sent:vi.fn(),retry:vi.fn(),manualReview:vi.fn() };
}
describe("outreach worker", () => {
  it("sends through configured provider", async () => {
    const q=queue("telegram"),sender={send:vi.fn().mockResolvedValue({providerMessageId:"9"})};
    expect(await new OutreachWorker(q,{telegram:sender}).runOnce()).toEqual({sent:1,retry:0,manualReview:0});
    expect(q.sent).toHaveBeenCalledWith("1","9");
  });
  it("requires manual review for unsupported platforms", async () => {
    const q=queue("linkedin");
    expect(await new OutreachWorker(q,{}).runOnce()).toEqual({sent:0,retry:0,manualReview:1});
    expect(q.manualReview).toHaveBeenCalled();
  });
});

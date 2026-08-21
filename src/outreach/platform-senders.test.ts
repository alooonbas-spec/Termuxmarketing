import { describe, expect, it, vi } from "vitest";
import { TelegramSender } from "./platform-senders.js";

describe("platform senders", () => {
  it("sends Telegram messages through Bot API", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { message_id: 42 } }), {
      status: 200, headers: { "content-type": "application/json" },
    }));
    const result = await new TelegramSender("token", fetchImpl).send("100", "Hello");
    expect(result).toEqual({ providerMessageId: "42" });
    expect(fetchImpl.mock.calls[0]?.[0]).toContain("/bottoken/sendMessage");
    expect(fetchImpl.mock.calls[0]?.[1]?.body).toContain('"chat_id":"100"');
  });
});

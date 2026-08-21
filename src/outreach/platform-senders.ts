import type { Platform } from "../domain/lead.js";

export interface SendResult { providerMessageId?: string }
export interface Sender { send(recipientId: string, text: string): Promise<SendResult> }

async function expectJson(response: Response): Promise<Record<string, unknown>> {
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok || body.error) throw new Error(`Provider HTTP ${response.status}: ${JSON.stringify(body.error ?? body)}`);
  return body;
}

export class TelegramSender implements Sender {
  constructor(private readonly token: string, private readonly fetchImpl: typeof fetch = fetch) {}
  async send(recipientId: string, text: string): Promise<SendResult> {
    const body = await expectJson(await this.fetchImpl(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: recipientId, text }),
      signal: AbortSignal.timeout(15000), }));
    const result = body.result as { message_id?: number } | undefined;
    return result?.message_id ? { providerMessageId: String(result.message_id) } : {};
  }
}

export class VkSender implements Sender {
  constructor(private readonly token: string, private readonly apiVersion: string, private readonly fetchImpl: typeof fetch = fetch) {}
  async send(recipientId: string, text: string): Promise<SendResult> {
    const params = new URLSearchParams({ user_id: recipientId, message: text, random_id: String(Math.floor(Math.random()*2147483647)), access_token: this.token, v: this.apiVersion });
    const body = await expectJson(await this.fetchImpl("https://api.vk.com/method/messages.send", { method: "POST", body: params, signal: AbortSignal.timeout(15000) }));
    return body.response != null ? { providerMessageId: String(body.response) } : {};
  }
}

export class MetaSender implements Sender {
  constructor(private readonly token: string, private readonly graphVersion: string, private readonly fetchImpl: typeof fetch = fetch) {}
  async send(recipientId: string, text: string): Promise<SendResult> {
    const body = await expectJson(await this.fetchImpl(`https://graph.facebook.com/${this.graphVersion}/me/messages?access_token=${encodeURIComponent(this.token)}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipient: { id: recipientId }, messaging_type: "RESPONSE", message: { text } }), signal: AbortSignal.timeout(15000), }));
    return body.message_id ? { providerMessageId: String(body.message_id) } : {};
  }
}

export type SenderRegistry = Partial<Record<Platform, Sender>>;

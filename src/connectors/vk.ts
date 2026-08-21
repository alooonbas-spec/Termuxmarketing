import type { LeadCandidate, SourceType } from "../domain/lead.js";
import { extractContacts } from "../services/contact-extractor.js";
import type { Connector } from "./types.js";

type VkEvent = {
  type?: string;
  object?: { message?: { id?: number; from_id?: number; text?: string }; id?: number; from_id?: number; text?: string };
  event_id?: string;
};

export class VkConnector implements Connector {
  readonly platform = "vk" as const;

  parse(event: unknown): LeadCandidate[] {
    const input = event as VkEvent;
    const message = input.object?.message ?? input.object;
    const userId = message?.from_id;
    if (!userId || !["message_new", "wall_reply_new", "wall_post_new"].includes(input.type ?? "")) return [];
    const text = message.text ?? "";
    const sourceType: SourceType = input.type === "message_new" ? "message" : "comment";
    return [{
      platform: this.platform,
      platformUserId: String(userId),
      profileUrl: `https://vk.com/id${userId}`,
      sourceType,
      sourceId: input.event_id ?? String(message.id ?? `${userId}:${Date.now()}`),
      ...(text ? { sourceText: text } : {}),
      consentStatus: "unknown",
      contacts: extractContacts(text),
      rawEvent: event,
      collectedAt: new Date(),
    }];
  }
}

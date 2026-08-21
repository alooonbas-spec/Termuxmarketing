import type { LeadCandidate, Platform } from "../domain/lead.js";
import { extractContacts } from "../services/contact-extractor.js";
import type { Connector } from "./types.js";

type MetaWebhook = {
  object?: string;
  entry?: Array<{
    id?: string;
    messaging?: Array<{ sender?: { id?: string }; message?: { mid?: string; text?: string } }>;
    changes?: Array<{ field?: string; value?: Record<string, unknown> }>;
  }>;
};

export class MetaConnector implements Connector {
  readonly platform: Platform;
  constructor(platform: "instagram" | "facebook") { this.platform = platform; }

  parse(event: unknown): LeadCandidate[] {
    const webhook = event as MetaWebhook;
    const leads: LeadCandidate[] = [];
    for (const entry of webhook.entry ?? []) {
      for (const item of entry.messaging ?? []) {
        const userId = item.sender?.id;
        if (!userId || !item.message?.mid) continue;
        const text = item.message.text ?? "";
        leads.push({
          platform: this.platform,
          platformUserId: userId,
          sourceType: "message",
          sourceId: item.message.mid,
          ...(text ? { sourceText: text } : {}),
          consentStatus: "unknown",
          contacts: extractContacts(text),
          rawEvent: item,
          collectedAt: new Date(),
        });
      }
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        const from = value.from as { id?: string; username?: string; name?: string } | undefined;
        const userId = from?.id;
        const sourceId = String(value.id ?? value.comment_id ?? "");
        if (!userId || !sourceId) continue;
        const text = String(value.text ?? value.message ?? "");
        leads.push({
          platform: this.platform,
          platformUserId: userId,
          ...(from.username ? { username: from.username } : {}),
          ...(from.name ? { displayName: from.name } : {}),
          sourceType: change.field === "leadgen" ? "form" : "comment",
          sourceId,
          ...(text ? { sourceText: text } : {}),
          consentStatus: change.field === "leadgen" ? "confirmed" : "unknown",
          contacts: extractContacts(text),
          rawEvent: change,
          collectedAt: new Date(),
        });
      }
    }
    return leads;
  }
}

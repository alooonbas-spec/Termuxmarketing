import type { LeadCandidate } from "../domain/lead.js";
import { extractContacts, normalizePhone } from "../services/contact-extractor.js";
import type { Connector } from "./types.js";

type TelegramUpdate = {
  update_id?: number;
  message?: {
    message_id?: number;
    text?: string;
    from?: { id?: number; username?: string; first_name?: string; last_name?: string };
    contact?: { phone_number?: string; first_name?: string; last_name?: string; user_id?: number };
  };
};

export class TelegramConnector implements Connector {
  readonly platform = "telegram" as const;

  parse(event: unknown): LeadCandidate[] {
    const update = event as TelegramUpdate;
    const message = update.message;
    const user = message?.from;
    if (!message || !user?.id) return [];
    const text = message.text ?? "";
    const contacts = extractContacts(text);
    const sharedPhone = message.contact?.phone_number
      ? normalizePhone(message.contact.phone_number)
      : null;
    if (sharedPhone) contacts.phones.push(sharedPhone);

    return [{
      platform: this.platform,
      platformUserId: String(user.id),
      ...(user.username ? { username: user.username } : {}),
      displayName: [user.first_name, user.last_name].filter(Boolean).join(" "),
      ...(user.username ? { profileUrl: `https://t.me/${user.username}` } : {}),
      sourceType: "message",
      sourceId: String(message.message_id ?? update.update_id ?? `${user.id}:${Date.now()}`),
      ...(text ? { sourceText: text } : {}),
      consentStatus: sharedPhone ? "confirmed" : "unknown",
      contacts: { ...contacts, phones: [...new Set(contacts.phones)] },
      rawEvent: event,
      collectedAt: new Date(),
    }];
  }
}

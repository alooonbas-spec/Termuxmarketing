import type { LeadCandidate } from "../domain/lead.js";
import { extractContacts } from "../services/contact-extractor.js";
import type { Connector } from "./types.js";

type PinterestResponse = { items?: Array<{ id?: string; title?: string; description?: string; link?: string; created_at?: string; board_owner?: { username?: string } }> };

export class PinterestConnector implements Connector {
  readonly platform = "pinterest" as const;
  parse(event: unknown): LeadCandidate[] {
    const response = event as PinterestResponse;
    return (response.items ?? []).flatMap((pin) => {
      const username = pin.board_owner?.username;
      if (!pin.id || !username) return [];
      const text = [pin.title, pin.description, pin.link].filter(Boolean).join("\n");
      return [{ platform: this.platform, platformUserId: username, username,
        profileUrl: `https://www.pinterest.com/${username}/`, sourceType: "public_profile" as const,
        sourceId: pin.id, sourceUrl: `https://www.pinterest.com/pin/${pin.id}/`,
        ...(text ? { sourceText: text } : {}), consentStatus: "not_required" as const,
        contacts: extractContacts(text), rawEvent: pin,
        collectedAt: pin.created_at ? new Date(pin.created_at) : new Date() }];
    });
  }
}

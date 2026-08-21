import type { LeadCandidate } from "../domain/lead.js";
import { extractContacts } from "../services/contact-extractor.js";
import type { Connector } from "./types.js";

type RedditListing = { data?: { children?: Array<{ data?: { id?: string; author?: string; selftext?: string; body?: string; title?: string; permalink?: string; created_utc?: number } }> } };

export class RedditConnector implements Connector {
  readonly platform = "reddit" as const;
  parse(event: unknown): LeadCandidate[] {
    const listing = event as RedditListing;
    return (listing.data?.children ?? []).flatMap((child) => {
      const item = child.data;
      if (!item?.id || !item.author || item.author === "[deleted]") return [];
      const text = [item.title, item.selftext, item.body].filter(Boolean).join("\n");
      return [{ platform: this.platform, platformUserId: item.author, username: item.author,
        profileUrl: `https://www.reddit.com/user/${encodeURIComponent(item.author)}`,
        sourceType: item.body ? "comment" as const : "public_profile" as const, sourceId: item.id,
        ...(item.permalink ? { sourceUrl: `https://www.reddit.com${item.permalink}` } : {}),
        ...(text ? { sourceText: text } : {}), consentStatus: "not_required" as const,
        contacts: extractContacts(text), rawEvent: item,
        collectedAt: item.created_utc ? new Date(item.created_utc * 1000) : new Date() }];
    });
  }
}

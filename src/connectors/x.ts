import type { LeadCandidate } from "../domain/lead.js";
import { extractContacts } from "../services/contact-extractor.js";
import type { Connector } from "./types.js";

type XResponse = { data?: Array<{ id?: string; text?: string; author_id?: string; created_at?: string }>; includes?: { users?: Array<{ id?: string; username?: string; name?: string; description?: string; url?: string }> } };

export class XConnector implements Connector {
  readonly platform = "x" as const;
  parse(event: unknown): LeadCandidate[] {
    const response = event as XResponse;
    const users = new Map((response.includes?.users ?? []).filter((u) => u.id).map((u) => [u.id!, u]));
    return (response.data ?? []).flatMap((post) => {
      if (!post.id || !post.author_id) return [];
      const user = users.get(post.author_id);
      const text = [post.text, user?.description, user?.url].filter(Boolean).join("\n");
      return [{ platform: this.platform, platformUserId: post.author_id,
        ...(user?.username ? { username: user.username, profileUrl: `https://x.com/${user.username}` } : {}),
        ...(user?.name ? { displayName: user.name } : {}), sourceType: "public_profile" as const,
        sourceId: post.id, sourceUrl: user?.username ? `https://x.com/${user.username}/status/${post.id}` : `https://x.com/i/status/${post.id}`,
        ...(text ? { sourceText: text } : {}), consentStatus: "not_required" as const,
        contacts: extractContacts(text), rawEvent: post, collectedAt: post.created_at ? new Date(post.created_at) : new Date() }];
    });
  }
}

import type { LeadCandidate, Platform, SourceType } from "../domain/lead.js";
import { extractContacts } from "../services/contact-extractor.js";
import type { Connector } from "./types.js";

export interface AuthorizedRecord {
  id?: string; userId?: string; username?: string; displayName?: string;
  profileUrl?: string; sourceUrl?: string; text?: string; email?: string;
  phone?: string; createdAt?: string; consent?: boolean; sourceType?: SourceType;
}
type AuthorizedImport = { records?: AuthorizedRecord[] } | AuthorizedRecord[];

export class LimitedPlatformConnector implements Connector {
  constructor(readonly platform: Extract<Platform, "linkedin" | "dzen" | "quora">) {}
  parse(event: unknown): LeadCandidate[] {
    const input = event as AuthorizedImport;
    const records = Array.isArray(input) ? input : input.records ?? [];
    return records.flatMap((record) => {
      const userId = record.userId ?? record.username;
      if (!record.id || !userId) return [];
      const sourceText = [record.text, record.email, record.phone].filter(Boolean).join("\n");
      return [{ platform: this.platform, platformUserId: userId,
        ...(record.username ? { username: record.username } : {}),
        ...(record.displayName ? { displayName: record.displayName } : {}),
        ...(record.profileUrl ? { profileUrl: record.profileUrl } : {}),
        sourceType: record.sourceType ?? "public_profile", sourceId: record.id,
        ...(record.sourceUrl ? { sourceUrl: record.sourceUrl } : {}),
        ...(sourceText ? { sourceText } : {}),
        consentStatus: record.consent ? "confirmed" : "not_required",
        contacts: extractContacts(sourceText), rawEvent: record,
        collectedAt: record.createdAt ? new Date(record.createdAt) : new Date() }];
    });
  }
}

export const platforms = [
  "vk",
  "telegram",
  "instagram",
  "facebook",
  "x",
  "linkedin",
  "dzen",
  "pinterest",
  "reddit",
  "quora",
] as const;

export type Platform = (typeof platforms)[number];
export type SourceType = "message" | "comment" | "form" | "public_profile";
export type ConsentStatus = "confirmed" | "not_required" | "unknown";

export interface ContactData {
  phones: string[];
  emails: string[];
  telegram: string[];
  urls: string[];
}

export interface LeadCandidate {
  platform: Platform;
  platformUserId: string;
  username?: string;
  displayName?: string;
  profileUrl?: string;
  sourceType: SourceType;
  sourceId: string;
  sourceUrl?: string;
  sourceText?: string;
  consentStatus: ConsentStatus;
  contacts: ContactData;
  rawEvent: unknown;
  collectedAt: Date;
}

export interface Lead extends LeadCandidate {
  id: string;
  score: number;
  createdAt: Date;
  updatedAt: Date;
}

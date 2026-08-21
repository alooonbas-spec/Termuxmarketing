import type { Campaign, CreateCampaignInput, CreateTemplateInput, MessageTemplate } from "./types.js";

export interface OutreachRepository {
  createTemplate(input: CreateTemplateInput): Promise<MessageTemplate>;
  listTemplates(): Promise<MessageTemplate[]>;
  createCampaign(input: CreateCampaignInput): Promise<Campaign>;
  launchCampaign(campaignId: string): Promise<{ queued: number; skipped: number }>;
  suppress(platform: string, platformUserId: string, reason: string): Promise<void>;
}

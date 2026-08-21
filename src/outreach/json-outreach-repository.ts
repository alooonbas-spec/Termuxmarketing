import { randomUUID } from "node:crypto";
import type { JsonDatabase, StoredCampaign, StoredLead, StoredMessageTemplate } from "../storage/json-database.js";
import type { OutreachRepository } from "./outreach-repository.js";
import { chooseVariant, renderTemplate, validateTemplate } from "./template-renderer.js";
import type { Campaign, CreateCampaignInput, CreateTemplateInput, MessageTemplate } from "./types.js";

function toTemplate(stored: StoredMessageTemplate): MessageTemplate {
  const { createdAt, ...rest } = structuredClone(stored);
  return { ...rest, createdAt: new Date(createdAt) };
}

function toCampaign(stored: StoredCampaign): Campaign {
  const { scheduledAt, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = structuredClone(stored);
  return { ...rest, scheduledAt: new Date(scheduledAt) };
}

function leadContext(lead: StoredLead): Record<string, string | undefined> {
  return {
    firstName: lead.displayName?.trim().split(/\s+/)[0],
    displayName: lead.displayName,
    username: lead.username,
    platform: lead.platform,
    profileUrl: lead.profileUrl,
  };
}

export class JsonOutreachRepository implements OutreachRepository {
  constructor(private readonly database: JsonDatabase) {}

  async createTemplate(input: CreateTemplateInput): Promise<MessageTemplate> {
    input.variants.forEach(validateTemplate);
    return this.database.transaction((state) => {
      const template: StoredMessageTemplate = {
        id: randomUUID(),
        name: input.name,
        platform: input.platform,
        variants: [...input.variants],
        createdAt: new Date().toISOString(),
      };
      state.messageTemplates.push(template);
      return toTemplate(template);
    });
  }

  async listTemplates(): Promise<MessageTemplate[]> {
    return this.database.query((state) => [...state.messageTemplates]
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .map(toTemplate));
  }

  async createCampaign(input: CreateCampaignInput): Promise<Campaign> {
    return this.database.transaction((state) => {
      if (!state.messageTemplates.some((template) => template.id === input.templateId)) throw new Error("Template not found");
      const now = new Date().toISOString();
      const campaign: StoredCampaign = {
        id: randomUUID(),
        name: input.name,
        templateId: input.templateId,
        platforms: [...input.platforms],
        minimumScore: input.minimumScore,
        scheduledAt: input.scheduledAt.toISOString(),
        status: "draft",
        createdAt: now,
        updatedAt: now,
      };
      state.campaigns.push(campaign);
      return toCampaign(campaign);
    });
  }

  async launchCampaign(campaignId: string): Promise<{ queued: number; skipped: number }> {
    return this.database.transaction((state) => {
      const campaign = state.campaigns.find((item) => item.id === campaignId);
      if (!campaign) throw new Error("Campaign not found");
      if (campaign.status !== "draft" && campaign.status !== "paused") throw new Error("Campaign cannot be launched from current status");
      const template = state.messageTemplates.find((item) => item.id === campaign.templateId);
      if (!template) throw new Error("Campaign template not found");

      const now = new Date().toISOString();
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      let queued = 0;
      let skipped = 0;
      const candidates = state.leads.filter((lead) =>
        campaign.platforms.includes(lead.platform)
        && lead.score >= campaign.minimumScore
        && (lead.consentStatus === "confirmed" || lead.sourceType === "message"));

      for (const lead of candidates) {
        const suppressed = state.suppressionList.some((item) => item.platform === lead.platform && item.platformUserId === lead.platformUserId);
        const recentlyContacted = state.outreachMessages.some((message) => message.leadId === lead.id && Date.parse(message.createdAt) > cutoff);
        const alreadyQueued = state.outreachMessages.some((message) => message.campaignId === campaign.id && message.leadId === lead.id);
        if (suppressed || recentlyContacted || alreadyQueued) {
          skipped += 1;
          continue;
        }

        const variantIndex = chooseVariant(template.variants, `${campaign.id}:${lead.id}`);
        const selected = template.variants[variantIndex];
        if (selected === undefined) throw new Error("Campaign template has no variants");
        state.outreachMessages.push({
          id: randomUUID(),
          campaignId: campaign.id,
          leadId: lead.id,
          platform: lead.platform,
          platformUserId: lead.platformUserId,
          variantIndex,
          renderedText: renderTemplate(selected, leadContext(lead)),
          status: "pending",
          attempts: 0,
          scheduledAt: campaign.scheduledAt,
          availableAt: now,
          createdAt: now,
          updatedAt: now,
        });
        queued += 1;
      }

      campaign.status = "queued";
      campaign.updatedAt = now;
      return { queued, skipped };
    });
  }

  async suppress(platform: string, platformUserId: string, reason: string): Promise<void> {
    await this.database.transaction((state) => {
      const existing = state.suppressionList.find((item) => item.platform === platform && item.platformUserId === platformUserId);
      if (existing) {
        existing.reason = reason;
        existing.createdAt = new Date().toISOString();
      } else {
        state.suppressionList.push({ platform, platformUserId, reason, createdAt: new Date().toISOString() });
      }
    });
  }
}

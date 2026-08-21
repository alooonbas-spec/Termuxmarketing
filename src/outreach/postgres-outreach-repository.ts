import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { chooseVariant, renderTemplate, validateTemplate } from "./template-renderer.js";
import type { OutreachRepository } from "./outreach-repository.js";
import type { Campaign, CreateCampaignInput, CreateTemplateInput, MessageTemplate } from "./types.js";
import type { Lead } from "../domain/lead.js";

export class PostgresOutreachRepository implements OutreachRepository {
  constructor(private readonly pool: Pool) {}

  async createTemplate(input: CreateTemplateInput): Promise<MessageTemplate> {
    input.variants.forEach(validateTemplate);
    const result = await this.pool.query<MessageTemplate>(
      `INSERT INTO message_templates(id,name,platform,variants) VALUES($1,$2,$3,$4::jsonb)
       RETURNING id,name,platform,variants,created_at AS "createdAt"`,
      [randomUUID(), input.name, input.platform, JSON.stringify(input.variants)],
    );
    return result.rows[0]!;
  }

  async listTemplates(): Promise<MessageTemplate[]> {
    return (await this.pool.query<MessageTemplate>(
      `SELECT id,name,platform,variants,created_at AS "createdAt" FROM message_templates ORDER BY created_at DESC`,
    )).rows;
  }

  async createCampaign(input: CreateCampaignInput): Promise<Campaign> {
    const result = await this.pool.query<Campaign>(
      `INSERT INTO campaigns(id,name,template_id,platforms,minimum_score,scheduled_at)
       VALUES($1,$2,$3,$4::jsonb,$5,$6)
       RETURNING id,name,template_id AS "templateId",platforms,minimum_score AS "minimumScore",scheduled_at AS "scheduledAt",status`,
      [randomUUID(), input.name, input.templateId, JSON.stringify(input.platforms), input.minimumScore, input.scheduledAt],
    );
    return result.rows[0]!;
  }

  async launchCampaign(campaignId: string): Promise<{ queued: number; skipped: number }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const campaignResult = await client.query<Campaign & { variants: string[] }>(
        `SELECT c.id,c.name,c.template_id AS "templateId",c.platforms,c.minimum_score AS "minimumScore",
          c.scheduled_at AS "scheduledAt",c.status,t.variants
         FROM campaigns c JOIN message_templates t ON t.id=c.template_id WHERE c.id=$1 FOR UPDATE`, [campaignId]);
      const campaign = campaignResult.rows[0];
      if (!campaign) throw new Error("Campaign not found");
      if (campaign.status !== "draft" && campaign.status !== "paused") throw new Error("Campaign cannot be launched from current status");
      const leads = (await client.query<Lead>(
        `SELECT l.id,l.platform,l.platform_user_id AS "platformUserId",l.username,l.display_name AS "displayName",l.profile_url AS "profileUrl",
          l.source_type AS "sourceType",l.source_id AS "sourceId",l.consent_status AS "consentStatus",l.contacts,l.raw_event AS "rawEvent",
          l.score,l.collected_at AS "collectedAt",l.created_at AS "createdAt",l.updated_at AS "updatedAt"
         FROM leads l WHERE l.platform = ANY($1::text[]) AND l.score >= $2
           AND (l.consent_status='confirmed' OR l.source_type='message')
           AND NOT EXISTS (SELECT 1 FROM suppression_list s WHERE s.platform=l.platform AND s.platform_user_id=l.platform_user_id)
           AND NOT EXISTS (SELECT 1 FROM outreach_messages m WHERE m.lead_id=l.id AND m.created_at > NOW()-INTERVAL '24 hours')`,
        [campaign.platforms, campaign.minimumScore],
      )).rows;
      let queued = 0;
      for (const lead of leads) {
        const variantIndex = chooseVariant(campaign.variants, `${campaign.id}:${lead.id}`);
        const firstName = lead.displayName?.trim().split(/\s+/)[0];
        const rendered = renderTemplate(campaign.variants[variantIndex]!, {
          firstName, displayName: lead.displayName, username: lead.username,
          platform: lead.platform, profileUrl: lead.profileUrl,
        });
        const result = await client.query(
          `INSERT INTO outreach_messages(id,campaign_id,lead_id,platform,platform_user_id,variant_index,rendered_text,scheduled_at)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(campaign_id,lead_id) DO NOTHING`,
          [randomUUID(), campaign.id, lead.id, lead.platform, lead.platformUserId, variantIndex, rendered, campaign.scheduledAt],
        );
        queued += result.rowCount ?? 0;
      }
      await client.query("UPDATE campaigns SET status='queued',updated_at=NOW() WHERE id=$1", [campaign.id]);
      await client.query("COMMIT");
      return { queued, skipped: Math.max(0, leads.length - queued) };
    } catch (error) {
      await client.query("ROLLBACK"); throw error;
    } finally { client.release(); }
  }

  async suppress(platform: string, platformUserId: string, reason: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO suppression_list(platform,platform_user_id,reason) VALUES($1,$2,$3)
       ON CONFLICT(platform,platform_user_id) DO UPDATE SET reason=EXCLUDED.reason,created_at=NOW()`,
      [platform, platformUserId, reason],
    );
  }
}

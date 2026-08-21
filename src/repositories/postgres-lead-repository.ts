import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { Lead, LeadCandidate } from "../domain/lead.js";
import { calculateLeadScore } from "../services/lead-score.js";
import type { LeadRepository, LeadStats } from "./lead-repository.js";

export class PostgresLeadRepository implements LeadRepository {
  constructor(private readonly pool: Pool) {}

  async upsert(candidate: LeadCandidate): Promise<Lead> {
    const client = await this.pool.connect();
    const id = randomUUID();
    const score = calculateLeadScore(candidate);
    try {
      await client.query("BEGIN");
      const result = await client.query<Lead>(
      `INSERT INTO leads (
        id, platform, platform_user_id, username, display_name, profile_url,
        source_type, source_id, source_url, source_text, consent_status,
        contacts, raw_event, score, collected_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14,$15)
      ON CONFLICT (platform, source_id) DO UPDATE SET
        username = COALESCE(EXCLUDED.username, leads.username),
        display_name = COALESCE(EXCLUDED.display_name, leads.display_name),
        profile_url = COALESCE(EXCLUDED.profile_url, leads.profile_url),
        source_text = COALESCE(EXCLUDED.source_text, leads.source_text),
        contacts = EXCLUDED.contacts,
        raw_event = EXCLUDED.raw_event,
        score = GREATEST(leads.score, EXCLUDED.score),
        updated_at = NOW()
      RETURNING
        id, platform, platform_user_id AS "platformUserId", username,
        display_name AS "displayName", profile_url AS "profileUrl",
        source_type AS "sourceType", source_id AS "sourceId",
        source_url AS "sourceUrl", source_text AS "sourceText",
        consent_status AS "consentStatus", contacts, raw_event AS "rawEvent",
        score, collected_at AS "collectedAt", created_at AS "createdAt",
        updated_at AS "updatedAt"`,
      [
        id, candidate.platform, candidate.platformUserId, candidate.username ?? null,
        candidate.displayName ?? null, candidate.profileUrl ?? null, candidate.sourceType,
        candidate.sourceId, candidate.sourceUrl ?? null, candidate.sourceText ?? null,
        candidate.consentStatus, JSON.stringify(candidate.contacts),
        JSON.stringify(candidate.rawEvent), score, candidate.collectedAt,
      ],
    );
      const lead = result.rows[0];
      if (!lead) throw new Error("Lead upsert returned no row");
      await client.query(
        `INSERT INTO crm_outbox(id, lead_id, lead_version, payload)
         VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (lead_id, lead_version) DO NOTHING`,
        [randomUUID(), lead.id, lead.updatedAt.toISOString(), JSON.stringify(lead)],
      );
      await client.query("COMMIT");
      return lead;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async list(limit: number, offset: number): Promise<Lead[]> {
    const result = await this.pool.query<Lead>(
      `SELECT id, platform, platform_user_id AS "platformUserId", username,
        display_name AS "displayName", profile_url AS "profileUrl",
        source_type AS "sourceType", source_id AS "sourceId",
        source_url AS "sourceUrl", source_text AS "sourceText",
        consent_status AS "consentStatus", contacts, raw_event AS "rawEvent",
        score, collected_at AS "collectedAt", created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM leads ORDER BY collected_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return result.rows;
  }

  async stats(): Promise<LeadStats> {
    const [summary, platforms] = await Promise.all([
      this.pool.query<{ total: string; withContacts: string; averageScore: string }>(
        `SELECT COUNT(*) AS total,
          COUNT(*) FILTER (WHERE jsonb_array_length(contacts->'phones') > 0 OR jsonb_array_length(contacts->'emails') > 0 OR jsonb_array_length(contacts->'telegram') > 0) AS "withContacts",
          COALESCE(AVG(score), 0) AS "averageScore" FROM leads`,
      ),
      this.pool.query<{ platform: string; count: string }>("SELECT platform, COUNT(*) AS count FROM leads GROUP BY platform ORDER BY count DESC"),
    ]);
    const row = summary.rows[0] ?? { total: "0", withContacts: "0", averageScore: "0" };
    return { total: Number(row.total), withContacts: Number(row.withContacts), averageScore: Number(row.averageScore),
      byPlatform: platforms.rows.map((item) => ({ platform: item.platform, count: Number(item.count) })) };
  }
}

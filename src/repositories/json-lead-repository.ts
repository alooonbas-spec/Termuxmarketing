import { randomUUID } from "node:crypto";
import type { Lead, LeadCandidate } from "../domain/lead.js";
import { calculateLeadScore } from "../services/lead-score.js";
import type { JsonDatabase, StoredLead } from "../storage/json-database.js";
import type { LeadRepository, LeadStats } from "./lead-repository.js";

function toLead(stored: StoredLead): Lead {
  const { collectedAt, createdAt, updatedAt, ...rest } = structuredClone(stored);
  return {
    ...rest,
    collectedAt: new Date(collectedAt),
    createdAt: new Date(createdAt),
    updatedAt: new Date(updatedAt),
  };
}

function nextTimestamp(previous?: string): string {
  const now = Date.now();
  const previousTime = previous ? Date.parse(previous) : 0;
  return new Date(Math.max(now, previousTime + 1)).toISOString();
}

export class JsonLeadRepository implements LeadRepository {
  constructor(private readonly database: JsonDatabase) {}

  async upsert(candidate: LeadCandidate): Promise<Lead> {
    return this.database.transaction((state) => {
      const existing = state.leads.find((lead) => lead.platform === candidate.platform && lead.sourceId === candidate.sourceId);
      const score = calculateLeadScore(candidate);
      const changedAt = nextTimestamp(existing?.updatedAt);
      let stored: StoredLead;
      let operation: "INSERT" | "UPDATE";

      if (existing) {
        if (candidate.username !== undefined) existing.username = candidate.username;
        if (candidate.displayName !== undefined) existing.displayName = candidate.displayName;
        if (candidate.profileUrl !== undefined) existing.profileUrl = candidate.profileUrl;
        if (candidate.sourceText !== undefined) existing.sourceText = candidate.sourceText;
        existing.contacts = structuredClone(candidate.contacts);
        existing.rawEvent = structuredClone(candidate.rawEvent);
        existing.score = Math.max(existing.score, score);
        existing.updatedAt = changedAt;
        stored = existing;
        operation = "UPDATE";
      } else {
        stored = {
          id: randomUUID(),
          platform: candidate.platform,
          platformUserId: candidate.platformUserId,
          ...(candidate.username !== undefined ? { username: candidate.username } : {}),
          ...(candidate.displayName !== undefined ? { displayName: candidate.displayName } : {}),
          ...(candidate.profileUrl !== undefined ? { profileUrl: candidate.profileUrl } : {}),
          sourceType: candidate.sourceType,
          sourceId: candidate.sourceId,
          ...(candidate.sourceUrl !== undefined ? { sourceUrl: candidate.sourceUrl } : {}),
          ...(candidate.sourceText !== undefined ? { sourceText: candidate.sourceText } : {}),
          consentStatus: candidate.consentStatus,
          contacts: structuredClone(candidate.contacts),
          rawEvent: structuredClone(candidate.rawEvent),
          score,
          collectedAt: candidate.collectedAt.toISOString(),
          createdAt: changedAt,
          updatedAt: changedAt,
        };
        state.leads.push(stored);
        operation = "INSERT";
      }

      state.leadAudit.push({
        auditId: randomUUID(),
        leadId: stored.id,
        operation,
        changedAt,
        snapshot: structuredClone(stored),
      });

      const leadVersion = stored.updatedAt;
      if (!state.crmOutbox.some((item) => item.leadId === stored.id && item.leadVersion === leadVersion)) {
        state.crmOutbox.push({
          id: randomUUID(),
          leadId: stored.id,
          leadVersion,
          payload: structuredClone(stored),
          status: "pending",
          attempts: 0,
          availableAt: changedAt,
          createdAt: changedAt,
          updatedAt: changedAt,
        });
      }

      return toLead(stored);
    });
  }

  async list(limit: number, offset: number): Promise<Lead[]> {
    return this.database.query((state) => [...state.leads]
      .sort((left, right) => Date.parse(right.collectedAt) - Date.parse(left.collectedAt))
      .slice(offset, offset + limit)
      .map(toLead));
  }

  async stats(): Promise<LeadStats> {
    return this.database.query((state) => {
      const totals = new Map<string, number>();
      let withContacts = 0;
      let scoreTotal = 0;
      for (const lead of state.leads) {
        totals.set(lead.platform, (totals.get(lead.platform) ?? 0) + 1);
        if (lead.contacts.phones.length || lead.contacts.emails.length || lead.contacts.telegram.length) withContacts += 1;
        scoreTotal += lead.score;
      }
      return {
        total: state.leads.length,
        withContacts,
        averageScore: state.leads.length ? scoreTotal / state.leads.length : 0,
        byPlatform: [...totals.entries()]
          .map(([platform, count]) => ({ platform, count }))
          .sort((left, right) => right.count - left.count),
      };
    });
  }
}

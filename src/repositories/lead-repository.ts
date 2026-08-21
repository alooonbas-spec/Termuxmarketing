import type { Lead, LeadCandidate } from "../domain/lead.js";

export interface LeadStats {
  total: number;
  withContacts: number;
  averageScore: number;
  byPlatform: Array<{ platform: string; count: number }>;
}

export interface LeadRepository {
  upsert(candidate: LeadCandidate): Promise<Lead>;
  list(limit: number, offset: number): Promise<Lead[]>;
  stats(): Promise<LeadStats>;
}

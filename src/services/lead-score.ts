import type { LeadCandidate } from "../domain/lead.js";

export function calculateLeadScore(lead: LeadCandidate): number {
  let score = 10;
  if (lead.contacts.phones.length > 0) score += 35;
  if (lead.contacts.emails.length > 0) score += 25;
  if (lead.contacts.telegram.length > 0) score += 20;
  if (lead.consentStatus === "confirmed") score += 10;
  return Math.min(score, 100);
}

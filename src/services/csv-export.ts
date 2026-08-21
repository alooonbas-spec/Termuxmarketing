import type { Lead } from "../domain/lead.js";

function escapeCsv(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function leadsToCsv(leads: Lead[]): string {
  const header = ["id", "platform", "username", "display_name", "profile_url", "phones", "emails", "telegram", "source_url", "score", "collected_at"];
  const rows = leads.map((lead) => [lead.id, lead.platform, lead.username, lead.displayName,
    lead.profileUrl, lead.contacts.phones.join(";"), lead.contacts.emails.join(";"),
    lead.contacts.telegram.join(";"), lead.sourceUrl, lead.score, lead.collectedAt.toISOString()]
    .map(escapeCsv).join(","));
  return `\uFEFF${[header.join(","), ...rows].join("\r\n")}\r\n`;
}

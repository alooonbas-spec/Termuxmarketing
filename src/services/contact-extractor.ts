import type { ContactData } from "../domain/lead.js";

const PHONE = /(?:\+?[1-9][\d\s().-]{8,}\d)/g;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const TELEGRAM = /https?:\/\/(?:t\.me|telegram\.me)\/[a-zA-Z0-9_]{5,32}|(?<![a-zA-Z0-9._%+-])@[a-zA-Z0-9_]{5,32}/g;
const URL = /https?:\/\/[^\s<>()]+/gi;

export function normalizePhone(value: string): string | null {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  if (digits.length < 10 || digits.length > 15) return null;
  return `+${digits}`;
}

export function extractContacts(text: string): ContactData {
  const phones = (text.match(PHONE) ?? [])
    .map(normalizePhone)
    .filter((value): value is string => value !== null);
  const emails = (text.match(EMAIL) ?? []).map((value) => value.toLowerCase());
  const telegram = (text.match(TELEGRAM) ?? []).map((value) =>
    value.replace(/^https?:\/\/(?:t\.me|telegram\.me)\//i, "@").toLowerCase(),
  );
  const urls = text.match(URL) ?? [];

  return {
    phones: [...new Set(phones)],
    emails: [...new Set(emails)],
    telegram: [...new Set(telegram)],
    urls: [...new Set(urls)],
  };
}

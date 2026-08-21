import "dotenv/config";
import { z } from "zod";

const optionalString = z.preprocess((value) => value === "" ? undefined : value, z.string().optional());
const optionalUrl = z.preprocess((value) => value === "" ? undefined : value, z.string().url().optional());
const optionalSecret = z.preprocess((value) => value === "" ? undefined : value, z.string().min(16).optional());
const commentAccounts = z.preprocess((value) => {
  if (!value) return [];
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return value; }
}, z.array(z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,50}$/),
  label: z.string().min(1).max(100),
  token: z.string().min(10),
  dailyLimit: z.coerce.number().int().min(1).max(100).default(10),
})).max(20).default([]));

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  HOST: z.string().default("0.0.0.0"),
  STORAGE_DRIVER: z.enum(["postgres", "json"]).default("postgres"),
  DATABASE_URL: optionalString,
  DATA_FILE: z.string().min(1).default("./data/collector.json"),
  ADMIN_API_KEY: z.string().min(16),
  PUBLIC_BASE_URL: optionalUrl,
  VK_CALLBACK_SECRET: optionalSecret,
  VK_CONFIRMATION_CODE: optionalString,
  TELEGRAM_WEBHOOK_SECRET: optionalSecret,
  META_VERIFY_TOKEN: optionalSecret,
  META_APP_SECRET: optionalSecret,
  CRM_WEBHOOK_URL: optionalUrl,
  CRM_WEBHOOK_SECRET: optionalSecret,
  CRM_WORKER_INTERVAL_MS: z.coerce.number().int().min(1000).default(10000),
  TELEGRAM_BOT_TOKEN: optionalString,
  VK_ACCESS_TOKEN: optionalString,
  VK_COMMENT_ACCOUNTS_JSON: commentAccounts,
  VK_API_VERSION: z.string().default("5.199"),
  META_PAGE_ACCESS_TOKEN: optionalString,
  META_GRAPH_VERSION: z.string().default("v23.0"),
  OUTREACH_WORKER_INTERVAL_MS: z.coerce.number().int().min(1000).default(10000),
}).superRefine((value, context) => {
  if (value.STORAGE_DRIVER === "postgres" && !value.DATABASE_URL) {
    context.addIssue({ code: "custom", path: ["DATABASE_URL"], message: "DATABASE_URL is required for postgres storage" });
  }
});

export const config = schema.parse(process.env);

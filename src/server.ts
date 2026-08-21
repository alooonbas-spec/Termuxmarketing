import pg from "pg";
import { buildApp } from "./app.js";
import { config } from "./config.js";
import type { LeadRepository } from "./repositories/lead-repository.js";
import { PostgresLeadRepository } from "./repositories/postgres-lead-repository.js";
import { JsonLeadRepository } from "./repositories/json-lead-repository.js";
import type { DeliveryQueue } from "./crm/delivery-queue.js";
import { PostgresDeliveryQueue } from "./crm/postgres-delivery-queue.js";
import { JsonDeliveryQueue } from "./crm/json-delivery-queue.js";
import { CrmWorker } from "./crm/crm-worker.js";
import type { OutreachRepository } from "./outreach/outreach-repository.js";
import { PostgresOutreachRepository } from "./outreach/postgres-outreach-repository.js";
import { JsonOutreachRepository } from "./outreach/json-outreach-repository.js";
import type { OutreachQueue } from "./outreach/message-queue.js";
import { PostgresMessageQueue } from "./outreach/postgres-message-queue.js";
import { JsonMessageQueue } from "./outreach/json-message-queue.js";
import { OutreachWorker } from "./outreach/outreach-worker.js";
import { MetaSender, TelegramSender, VkSender, type SenderRegistry } from "./outreach/platform-senders.js";
import type { CommentRepository } from "./comments/comment-repository.js";
import { PostgresCommentRepository, initializeCommentSchema } from "./comments/postgres-comment-repository.js";
import { JsonCommentRepository } from "./comments/json-comment-repository.js";
import { CommentService } from "./comments/comment-service.js";
import { VkCommentPublisher } from "./comments/vk-comment-publisher.js";
import { JsonDatabase } from "./storage/json-database.js";

let pool: pg.Pool | undefined;
let jsonDatabase: JsonDatabase | undefined;
let repository: LeadRepository;
let deliveryQueue: DeliveryQueue;
let outreachRepository: OutreachRepository;
let outreachQueue: OutreachQueue;
let commentRepository: CommentRepository;

if (config.STORAGE_DRIVER === "json") {
  jsonDatabase = new JsonDatabase(config.DATA_FILE);
  await jsonDatabase.initialize();
  repository = new JsonLeadRepository(jsonDatabase);
  deliveryQueue = new JsonDeliveryQueue(jsonDatabase);
  outreachRepository = new JsonOutreachRepository(jsonDatabase);
  outreachQueue = new JsonMessageQueue(jsonDatabase);
  commentRepository = new JsonCommentRepository(jsonDatabase);
} else {
  if (!config.DATABASE_URL) throw new Error("DATABASE_URL is required for postgres storage");
  pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 10 });
  await initializeCommentSchema(pool);
  repository = new PostgresLeadRepository(pool);
  deliveryQueue = new PostgresDeliveryQueue(pool);
  outreachRepository = new PostgresOutreachRepository(pool);
  outreachQueue = new PostgresMessageQueue(pool);
  commentRepository = new PostgresCommentRepository(pool);
}

const commentService = new CommentService(
  commentRepository,
  config.VK_COMMENT_ACCOUNTS_JSON,
  new VkCommentPublisher(config.VK_API_VERSION),
);
const app = await buildApp(repository, {
  adminApiKey: config.ADMIN_API_KEY,
  ...(config.PUBLIC_BASE_URL ? { publicBaseUrl: config.PUBLIC_BASE_URL } : {}),
  ...(config.VK_CALLBACK_SECRET ? { vkSecret: config.VK_CALLBACK_SECRET } : {}),
  ...(config.VK_CONFIRMATION_CODE ? { vkConfirmationCode: config.VK_CONFIRMATION_CODE } : {}),
  ...(config.TELEGRAM_WEBHOOK_SECRET ? { telegramSecret: config.TELEGRAM_WEBHOOK_SECRET } : {}),
  ...(config.META_VERIFY_TOKEN ? { metaVerifyToken: config.META_VERIFY_TOKEN } : {}),
  ...(config.META_APP_SECRET ? { metaAppSecret: config.META_APP_SECRET } : {}),
}, outreachRepository, commentService);

let crmTimer: NodeJS.Timeout | undefined;
if (config.CRM_WEBHOOK_URL && config.CRM_WEBHOOK_SECRET) {
  const worker = new CrmWorker(deliveryQueue, {
    webhookUrl: config.CRM_WEBHOOK_URL,
    secret: config.CRM_WEBHOOK_SECRET,
  });
  crmTimer = setInterval(() => void worker.runOnce().catch((error) => app.log.error(error)), config.CRM_WORKER_INTERVAL_MS);
  crmTimer.unref();
}

const senders: SenderRegistry = {};
if (config.TELEGRAM_BOT_TOKEN) senders.telegram = new TelegramSender(config.TELEGRAM_BOT_TOKEN);
if (config.VK_ACCESS_TOKEN) senders.vk = new VkSender(config.VK_ACCESS_TOKEN, config.VK_API_VERSION);
if (config.META_PAGE_ACCESS_TOKEN) {
  const metaSender = new MetaSender(config.META_PAGE_ACCESS_TOKEN, config.META_GRAPH_VERSION);
  senders.facebook = metaSender;
  senders.instagram = metaSender;
}
const outreachWorker = new OutreachWorker(outreachQueue, senders);
const outreachTimer = setInterval(() => void outreachWorker.runOnce().catch((error) => app.log.error(error)), config.OUTREACH_WORKER_INTERVAL_MS);
outreachTimer.unref();

let stopping = false;
const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  if (crmTimer) clearInterval(crmTimer);
  clearInterval(outreachTimer);
  await app.close();
  if (pool) await pool.end();
  if (jsonDatabase) await jsonDatabase.close();
};
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

await app.listen({ port: config.PORT, host: config.HOST });
app.log.info({ storage: config.STORAGE_DRIVER, dataFile: config.STORAGE_DRIVER === "json" ? jsonDatabase?.filePath : undefined }, "Social Contact Collector started");

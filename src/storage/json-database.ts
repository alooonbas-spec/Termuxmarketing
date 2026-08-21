import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { ContactData, ConsentStatus, Platform, SourceType } from "../domain/lead.js";

export interface StoredLead {
  id: string;
  platform: Platform;
  platformUserId: string;
  username?: string;
  displayName?: string;
  profileUrl?: string;
  sourceType: SourceType;
  sourceId: string;
  sourceUrl?: string;
  sourceText?: string;
  consentStatus: ConsentStatus;
  contacts: ContactData;
  rawEvent: unknown;
  score: number;
  collectedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredLeadAudit {
  auditId: string;
  leadId: string;
  operation: "INSERT" | "UPDATE";
  changedAt: string;
  snapshot: StoredLead;
}

export interface StoredCrmOutboxItem {
  id: string;
  leadId: string;
  leadVersion: string;
  payload: unknown;
  status: "pending" | "processing" | "retry" | "sent" | "failed";
  attempts: number;
  availableAt: string;
  lastError?: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredMessageTemplate {
  id: string;
  name: string;
  platform: Platform | "all";
  variants: string[];
  createdAt: string;
}

export interface StoredCampaign {
  id: string;
  name: string;
  templateId: string;
  platforms: Platform[];
  minimumScore: number;
  scheduledAt: string;
  status: "draft" | "queued" | "running" | "completed" | "paused";
  createdAt: string;
  updatedAt: string;
}

export interface StoredSuppression {
  platform: string;
  platformUserId: string;
  reason: string;
  createdAt: string;
}

export interface StoredOutreachMessage {
  id: string;
  campaignId: string;
  leadId: string;
  platform: Platform;
  platformUserId: string;
  variantIndex: number;
  renderedText: string;
  status: "pending" | "processing" | "sent" | "retry" | "failed" | "cancelled" | "manual_review";
  attempts: number;
  scheduledAt: string;
  availableAt: string;
  providerMessageId?: string;
  lastError?: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredCommentPublication {
  id: string;
  platform: "vk";
  accountId: string;
  accountLabel: string;
  targetUrl: string;
  ownerId: number;
  postId: number;
  text: string;
  status: "draft" | "published" | "failed";
  providerCommentId?: string;
  providerUrl?: string;
  lastError?: string;
  createdAt: string;
  publishedAt?: string;
}

export interface JsonDatabaseState {
  schemaVersion: 1;
  leads: StoredLead[];
  leadAudit: StoredLeadAudit[];
  crmOutbox: StoredCrmOutboxItem[];
  messageTemplates: StoredMessageTemplate[];
  campaigns: StoredCampaign[];
  suppressionList: StoredSuppression[];
  outreachMessages: StoredOutreachMessage[];
  commentPublications: StoredCommentPublication[];
}

function emptyState(): JsonDatabaseState {
  return {
    schemaVersion: 1,
    leads: [],
    leadAudit: [],
    crmOutbox: [],
    messageTemplates: [],
    campaigns: [],
    suppressionList: [],
    outreachMessages: [],
    commentPublications: [],
  };
}

function normalizeState(value: unknown): JsonDatabaseState {
  if (!value || typeof value !== "object") throw new Error("Файл данных повреждён: корневой JSON должен быть объектом");
  const source = value as Partial<JsonDatabaseState>;
  if (source.schemaVersion !== 1) throw new Error(`Неподдерживаемая версия файла данных: ${String(source.schemaVersion)}`);
  const requiredArrays: Array<keyof Omit<JsonDatabaseState, "schemaVersion">> = [
    "leads", "leadAudit", "crmOutbox", "messageTemplates", "campaigns",
    "suppressionList", "outreachMessages", "commentPublications",
  ];
  for (const key of requiredArrays) {
    if (!Array.isArray(source[key])) throw new Error(`Файл данных повреждён: поле ${key} должно быть массивом`);
  }
  return source as JsonDatabaseState;
}

export class JsonDatabase {
  readonly filePath: string;
  private state = emptyState();
  private initialized = false;
  private queue: Promise<void> = Promise.resolve();

  constructor(filePath: string) {
    this.filePath = resolve(filePath);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await mkdir(dirname(this.filePath), { recursive: true });
    try {
      const raw = await readFile(this.filePath, "utf8");
      this.state = normalizeState(JSON.parse(raw) as unknown);
      const recoveredAt = new Date().toISOString();
      let recovered = false;
      for (const item of this.state.crmOutbox) {
        if (item.status !== "processing") continue;
        item.status = "retry";
        item.availableAt = recoveredAt;
        item.updatedAt = recoveredAt;
        recovered = true;
      }
      for (const message of this.state.outreachMessages) {
        if (message.status !== "processing") continue;
        message.status = "retry";
        message.availableAt = recoveredAt;
        message.updatedAt = recoveredAt;
        recovered = true;
      }
      if (recovered) await this.persist(this.state);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      this.state = emptyState();
      await this.persist(this.state);
    }
    this.initialized = true;
  }

  async query<T>(reader: (state: Readonly<JsonDatabaseState>) => T): Promise<T> {
    this.ensureInitialized();
    await this.queue;
    return reader(this.state);
  }

  async transaction<T>(writer: (state: JsonDatabaseState) => T): Promise<T> {
    this.ensureInitialized();
    const operation = this.queue.then(async () => {
      const draft = structuredClone(this.state);
      const result = writer(draft);
      await this.persist(draft);
      this.state = draft;
      return result;
    });
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async close(): Promise<void> {
    await this.queue;
  }

  private ensureInitialized(): void {
    if (!this.initialized) throw new Error("JsonDatabase.initialize() must be called before use");
  }

  private async persist(state: JsonDatabaseState): Promise<void> {
    const temporary = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, this.filePath);
  }
}

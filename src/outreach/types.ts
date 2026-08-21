import type { Platform } from "../domain/lead.js";

export interface MessageTemplate {
  id: string;
  name: string;
  platform: Platform | "all";
  variants: string[];
  createdAt: Date;
}

export interface Campaign {
  id: string;
  name: string;
  templateId: string;
  platforms: Platform[];
  minimumScore: number;
  scheduledAt: Date;
  status: "draft" | "queued" | "running" | "completed" | "paused";
}

export interface CreateTemplateInput {
  name: string;
  platform: Platform | "all";
  variants: string[];
}

export interface CreateCampaignInput {
  name: string;
  templateId: string;
  platforms: Platform[];
  minimumScore: number;
  scheduledAt: Date;
}

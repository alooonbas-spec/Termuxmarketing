import type { LeadCandidate, Platform } from "../domain/lead.js";

export interface Connector {
  readonly platform: Platform;
  parse(event: unknown): LeadCandidate[];
}

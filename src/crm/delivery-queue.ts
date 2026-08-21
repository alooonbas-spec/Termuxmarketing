export interface DeliveryJob {
  id: string;
  payload: unknown;
  attempts: number;
}

export interface DeliveryQueue {
  claim(limit: number): Promise<DeliveryJob[]>;
  complete(id: string): Promise<void>;
  retry(id: string, error: string, delaySeconds: number): Promise<void>;
}

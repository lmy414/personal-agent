/**
 * Shared DB path, pricing, and helpers for Personal Agent extensions.
 */
import path from "path";
import os from "os";

export const PA_DIR = path.join(os.homedir(), ".personal-agent");
export const DB_PATH = path.join(PA_DIR, "agent.db");
export const USD_CNY_RATE = 7.3;

export interface Pricing {
  input: number;
  output: number;
}

const PRICING: Record<string, Pricing> = {
  "deepseek-chat": { input: 0.27, output: 1.1 },
  "deepseek-reasoner": { input: 0.55, output: 2.19 },
};

export function getPricing(modelId: string): Pricing {
  if (!modelId) return { input: 0.27, output: 1.1 };
  for (const [key, p] of Object.entries(PRICING)) {
    if (modelId.toLowerCase().includes(key.toLowerCase())) return p;
  }
  return { input: 0.27, output: 1.1 };
}

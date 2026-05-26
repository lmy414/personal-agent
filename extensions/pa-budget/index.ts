/**
 * pa-budget — API cost budget monitor with warnings and spend limits.
 * Integrates with the shared SQLite for usage data.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import Database from "better-sqlite3";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

const PA_DIR = path.join(os.homedir(), ".personal-agent");
const DB_PATH = path.join(PA_DIR, "agent.db");
const USD_CNY_RATE = 7.3;

const PRICING: Record<string, { input: number; output: number }> = {
  "deepseek-chat": { input: 0.27, output: 1.1 },
  "deepseek-reasoner": { input: 0.55, output: 2.19 },
};

function getPricing(modelId: string) {
  for (const [key, p] of Object.entries(PRICING)) {
    if (modelId.toLowerCase().includes(key)) return p;
  }
  return { input: 0.27, output: 1.1 };
}

// ── Budget state ───────────────────────────────────────────────

let monthlyBudget = 50;  // USD
let dailyBudget = 10;    // USD
let warnOnBudget = true;
let blockOnBudget = false;

function getTodayCost(): number {
  if (!fs.existsSync(DB_PATH)) return 0;
  const db = new Database(DB_PATH, { readonly: true });
  const today = new Date().toISOString().slice(0, 10);
  const rows = db.prepare("SELECT model, tokens_input, tokens_output FROM usage_log WHERE date = ?").all(today) as any[];
  db.close();

  let total = 0;
  for (const row of rows) {
    const p = getPricing(row.model);
    total += (row.tokens_input / 1e6) * p.input + (row.tokens_output / 1e6) * p.output;
  }
  return total;
}

function getMonthCost(): number {
  if (!fs.existsSync(DB_PATH)) return 0;
  const db = new Database(DB_PATH, { readonly: true });
  const rows = db.prepare("SELECT model, tokens_input, tokens_output FROM usage_log WHERE date >= date('now','start of month','localtime')").all() as any[];
  db.close();

  let total = 0;
  for (const row of rows) {
    const p = getPricing(row.model);
    total += (row.tokens_input / 1e6) * p.input + (row.tokens_output / 1e6) * p.output;
  }
  return total;
}

// ── Extension ──────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // Check on each turn start
  pi.on("turn_start", async (_event, ctx) => {
    if (!warnOnBudget) return;

    const dayCost = getTodayCost();
    const monthCost = getMonthCost();

    const warnings: string[] = [];
    if (dayCost >= dailyBudget) warnings.push(`Daily budget exceeded: $${dayCost.toFixed(3)} / $${dailyBudget}`);
    else if (dayCost >= dailyBudget * 0.8) warnings.push(`Daily budget warning: $${dayCost.toFixed(3)} / $${dailyBudget}`);
    if (monthCost >= monthlyBudget) warnings.push(`Monthly budget exceeded: $${monthCost.toFixed(3)} / $${monthlyBudget}`);
    else if (monthCost >= monthlyBudget * 0.8) warnings.push(`Monthly budget warning: $${monthCost.toFixed(3)} / $${monthlyBudget}`);

    if (warnings.length > 0) {
      const overLimit = dayCost >= dailyBudget || monthCost >= monthlyBudget;
      ctx.ui.notify(warnings.join("\n"), overLimit ? "error" : "warning");

      if (overLimit && blockOnBudget) {
        ctx.ui.notify("Budget block active — aborting turn", "error");
        ctx.abort();
      }
    }
  });

  // /budget — view status
  pi.registerCommand("budget", {
    description: "View or set budget (usage: /budget [set <monthly> <daily>])",
    handler: async (args, ctx) => {
      const parts = args.trim().split(/\s+/);
      if (parts[0] === "set" && parts.length >= 3) {
        const m = parseFloat(parts[1]);
        const d = parseFloat(parts[2]);
        if (isNaN(m) || isNaN(d) || m <= 0 || d <= 0) {
          ctx.ui.notify("Usage: /budget set <monthly_usd> <daily_usd>", "warning");
          return;
        }
        monthlyBudget = m;
        dailyBudget = d;
        ctx.ui.notify(`Budget set: $${m}/month, $${d}/day`, "info");
        return;
      }

      const dayCost = getTodayCost();
      const monthCost = getMonthCost();
      const dayPct = ((dayCost / dailyBudget) * 100).toFixed(1);
      const monthPct = ((monthCost / monthlyBudget) * 100).toFixed(1);

      const lines = [
        `Monthly: $${monthCost.toFixed(3)} / $${monthlyBudget} (${monthPct}%)`,
        `Daily:   $${dayCost.toFixed(3)} / $${dailyBudget} (${dayPct}%)`,
        `¥${(monthCost * USD_CNY_RATE).toFixed(2)} / ${warnOnBudget ? "warn" : "silent"}${blockOnBudget ? " + block" : ""}`,
      ];
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });
}

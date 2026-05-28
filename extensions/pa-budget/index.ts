/**
 * pa-budget — API cost budget monitor with warnings and spend limits.
 * Integrates with the shared SQLite for usage data.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import Database from "better-sqlite3";
import * as fs from "fs";
import { DB_PATH, USD_CNY_RATE, getPricing } from "../shared/db-config";

// ── Budget state ───────────────────────────────────────────────

let monthlyBudget = 50;  // USD
let dailyBudget = 10;    // USD
let warnOnBudget = true;
let blockOnBudget = false;

function calcCost(rows: Array<{ model: string; tokens_input: number; tokens_output: number }>): number {
  let total = 0;
  for (const row of rows) {
    const p = getPricing(row.model);
    total += (row.tokens_input / 1e6) * p.input + (row.tokens_output / 1e6) * p.output;
  }
  return total;
}

// ── Extension ──────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  let db: Database.Database | null = null;

  pi.on("session_start", async () => {
    if (fs.existsSync(DB_PATH)) {
      db = new Database(DB_PATH, { readonly: true });
    }
  });

  pi.on("session_shutdown", async () => {
    if (db) { db.close(); db = null; }
  });

  function getTodayCost(): number {
    if (!db) return 0;
    const today = new Date().toISOString().slice(0, 10);
    const rows = db.prepare("SELECT model, tokens_input, tokens_output FROM usage_log WHERE date = ?").all(today) as any[];
    return calcCost(rows);
  }

  function getMonthCost(): number {
    if (!db) return 0;
    const rows = db.prepare("SELECT model, tokens_input, tokens_output FROM usage_log WHERE date >= date('now','start of month','localtime')").all() as any[];
    return calcCost(rows);
  }

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

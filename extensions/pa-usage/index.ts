/**
 * pa-usage — Token usage tracking + cost calculation with /usage and /cost commands.
 * Writes to the shared SQLite database at ~/.personal-agent/agent.db.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import Database from "better-sqlite3";
import path from "path";
import os from "os";
import fs from "fs";

const PA_DIR = path.join(os.homedir(), ".personal-agent");
const DB_PATH = path.join(PA_DIR, "agent.db");
const USD_CNY_RATE = 7.3;

// ── Pricing data (per 1M tokens, USD) ─────────────────────────

interface Pricing {
  input: number;
  output: number;
}

const PRICING: Record<string, Pricing> = {
  "deepseek-chat": { input: 0.27, output: 1.1 },
  "deepseek-reasoner": { input: 0.55, output: 2.19 },
};

function getPricing(modelId: string): Pricing {
  if (!modelId) return { input: 0.27, output: 1.1 };
  for (const [key, p] of Object.entries(PRICING)) {
    if (modelId.toLowerCase().includes(key.toLowerCase())) return p;
  }
  return { input: 0.27, output: 1.1 };
}

// ── DB helpers ─────────────────────────────────────────────────

function openDB(): Database.Database {
  if (!fs.existsSync(PA_DIR)) fs.mkdirSync(PA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  return db;
}

function recordUsage(db: Database.Database, model: string, tokensIn: number, tokensOut: number): void {
  if (tokensIn === 0 && tokensOut === 0) return;
  const today = new Date().toISOString().slice(0, 10);

  const existing = db.prepare(
    "SELECT id, tokens_input, tokens_output, request_count FROM usage_log WHERE date = ? AND model = ?",
  ).get(today, model) as { id: number } | undefined;

  if (existing) {
    db.prepare(
      "UPDATE usage_log SET tokens_input = tokens_input + ?, tokens_output = tokens_output + ?, request_count = request_count + 1 WHERE id = ?",
    ).run(tokensIn, tokensOut, existing.id);
  } else {
    db.prepare(
      "INSERT INTO usage_log (date, model, tokens_input, tokens_output, request_count) VALUES (?, ?, ?, ?, 1)",
    ).run(today, model, tokensIn, tokensOut);
  }
}

function getStats(db: Database.Database, period: string) {
  let dateFilter: string;
  if (period === "today") dateFilter = "date = date('now','localtime')";
  else if (period === "month") dateFilter = "date >= date('now','start of month','localtime')";
  else if (period === "14d") dateFilter = "date >= date('now','-14 days','localtime')";
  else dateFilter = "1=1";

  const rows = db.prepare(
    `SELECT date, model, tokens_input, tokens_output, request_count FROM usage_log WHERE ${dateFilter} ORDER BY date DESC`,
  ).all() as Array<{ date: string; model: string; tokens_input: number; tokens_output: number; request_count: number }>;

  let totalInput = 0, totalOutput = 0, totalRequests = 0, totalCostUsd = 0;

  for (const row of rows) {
    totalInput += row.tokens_input;
    totalOutput += row.tokens_output;
    totalRequests += row.request_count;
    const p = getPricing(row.model);
    totalCostUsd += (row.tokens_input / 1e6) * p.input + (row.tokens_output / 1e6) * p.output;
  }

  return { totalInput, totalOutput, totalTokens: totalInput + totalOutput, totalRequests, totalCostUsd, totalCostCny: +(totalCostUsd * USD_CNY_RATE).toFixed(2), rows };
}

// ── Extension ──────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  let db: Database.Database | null = null;

  pi.on("session_start", async () => {
    db = openDB();
  });

  pi.on("session_shutdown", async () => {
    if (db) { db.close(); db = null; }
  });

  // Capture token usage from assistant messages
  pi.on("message_end", async (event) => {
    if (!db) return;
    const msg = event.message as Record<string, any>;
    if (msg.role !== "assistant") return;

    const usage = msg.usage;
    if (!usage) return;

    const tokensIn = (usage.input ?? 0) as number;
    const tokensOut = (usage.output ?? 0) as number;
    const model = (msg.model ?? "unknown") as string;

    recordUsage(db, model, tokensIn, tokensOut);
  });

  // ── /cost — show cost summary ──────────────────────────────

  pi.registerCommand("cost", {
    description: "Show estimated API cost (USD/CNY)",
    handler: async (_args, ctx) => {
      if (!db) { ctx.ui.notify("pa-usage: database not ready", "warning"); return; }
      const stats = getStats(db, "month");
      const lines = [
        `Tokens: ${stats.totalTokens.toLocaleString()} (in: ${stats.totalInput.toLocaleString()} / out: ${stats.totalOutput.toLocaleString()})`,
        `Requests: ${stats.totalRequests}`,
        `Cost (month): $${stats.totalCostUsd.toFixed(4)} / ¥${stats.totalCostCny}`,
      ];
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  // ── /usage [period] — show detailed stats ──────────────────

  pi.registerCommand("usage", {
    description: "Show token usage (usage: /usage [today|month|14d])",
    getArgumentCompletions: () => [
      { value: "today", label: "Today" },
      { value: "month", label: "This month" },
      { value: "14d", label: "Last 14 days" },
    ],
    handler: async (args, ctx) => {
      if (!db) { ctx.ui.notify("pa-usage: database not ready", "warning"); return; }
      const period = args.trim() || "month";
      const stats = getStats(db, period);
      const dateWidth = 10;
      const header = `Token Usage (${period})`.padEnd(dateWidth) + "  Input  Output   Reqs     Cost";
      const sep = "-".repeat(header.length);
      const detailLines = stats.rows.slice(0, 30).map((r) => {
        const p = getPricing(r.model);
        const cost = ((r.tokens_input / 1e6) * p.input + (r.tokens_output / 1e6) * p.output);
        return `${r.date.padEnd(dateWidth)} ${String(r.tokens_input).padStart(6)} ${String(r.tokens_output).padStart(7)} ${String(r.request_count).padStart(5)} ¥${cost.toFixed(2)}`;
      });
      const total = [
        "",
        `Total: ${stats.totalTokens.toLocaleString()} tokens | ${stats.totalRequests} reqs | $${stats.totalCostUsd.toFixed(4)} / ¥${stats.totalCostCny}`,
      ];
      ctx.ui.notify([header, sep, ...detailLines, ...total].join("\n"), "info");
    },
  });
}

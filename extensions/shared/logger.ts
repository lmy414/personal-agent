/**
 * Structured diagnostic logger for Personal Agent extensions.
 * Writes JSON lines to ~/.personal-agent/logs/pa-diag-<ts>.log
 */

import fs from "fs";
import path from "path";
import os from "os";

const DIAG_DIR = path.join(os.homedir(), ".personal-agent", "logs");
const DIAG_FILE = path.join(DIAG_DIR, `pa-diag-${Date.now()}.log`);

type Level = "DEBUG" | "INFO" | "WARN" | "ERROR";
type CheckFn = () => { ok: boolean; detail: string } | null;

interface LogEntry {
  ts: string;
  lvl: Level;
  src: string;
  msg: string;
  ctx?: Record<string, unknown>;
}

let stream: ReturnType<typeof fs.createWriteStream> | null = null;
let anomalyChecks: { name: string; fn: CheckFn; intervalMs: number; lastRun: number }[] = [];
let checkTimer: ReturnType<typeof setInterval> | null = null;

function ensureStream() {
  if (!stream) {
    if (!fs.existsSync(DIAG_DIR)) fs.mkdirSync(DIAG_DIR, { recursive: true });
    stream = fs.createWriteStream(DIAG_FILE, { flags: "a" });
  }
  return stream;
}

export function log(lvl: Level, src: string, msg: string, ctx?: Record<string, unknown>) {
  const entry: LogEntry = { ts: new Date().toISOString(), lvl, src, msg, ctx };
  const line = JSON.stringify(entry) + "\n";
  // Always print to console for pi stderr visibility
  const prefix = lvl === "ERROR" ? "❌" : lvl === "WARN" ? "⚠" : lvl === "DEBUG" ? "🔍" : "✓";
  console.error(`[pa-diag] ${prefix} [${src}] ${msg}${ctx ? " " + JSON.stringify(ctx) : ""}`);
  try { ensureStream().write(line); } catch {}
}

export function debug(src: string, msg: string, ctx?: Record<string, unknown>) { log("DEBUG", src, msg, ctx); }
export function info(src: string, msg: string, ctx?: Record<string, unknown>) { log("INFO", src, msg, ctx); }
export function warn(src: string, msg: string, ctx?: Record<string, unknown>) { log("WARN", src, msg, ctx); }
export function error(src: string, msg: string, ctx?: Record<string, unknown>) { log("ERROR", src, msg, ctx); }

// ── Anomaly check registry ──────────────────────────────
export function registerCheck(name: string, fn: CheckFn, intervalMs = 10000) {
  anomalyChecks.push({ name, fn, intervalMs, lastRun: 0 });
  if (!checkTimer) {
    checkTimer = setInterval(runChecks, 5000);
  }
}

function runChecks() {
  const now = Date.now();
  for (const c of anomalyChecks) {
    if (now - c.lastRun >= c.intervalMs) {
      c.lastRun = now;
      try {
        const result = c.fn();
        if (result && !result.ok) {
          warn("anomaly", c.name, { detail: result.detail });
        }
      } catch (e: any) {
        error("anomaly", `check "${c.name}" crashed: ${e?.message || e}`);
      }
    }
  }
}

export function close() {
  if (checkTimer) { clearInterval(checkTimer); checkTimer = null; }
  anomalyChecks = [];
  if (stream) { stream.end(); stream = null; }
}

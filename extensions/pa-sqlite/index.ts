/**
 * pa-sqlite — SQLite session persistence for Personal Agent.
 * Mirrors Pi session messages into SQLite for cross-session queries and analytics.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import Database from "better-sqlite3";
import path from "path";
import os from "os";
import fs from "fs";

const PA_DIR = path.join(os.homedir(), ".personal-agent");
const DB_PATH = path.join(PA_DIR, "agent.db");

// ── DB lifecycle ──────────────────────────────────────────────

function createDB(): Database.Database {
  if (!fs.existsSync(PA_DIR)) fs.mkdirSync(PA_DIR, { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT 'New Chat',
      session_id TEXT UNIQUE,
      session_file TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      message_id TEXT DEFAULT '',
      role TEXT NOT NULL CHECK(role IN ('user','assistant','system','tool')),
      content TEXT NOT NULL,
      tokens_input INTEGER DEFAULT 0,
      tokens_output INTEGER DEFAULT 0,
      model TEXT DEFAULT '',
      attachments TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS usage_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL DEFAULT (date('now','localtime')),
      model TEXT NOT NULL,
      tokens_input INTEGER NOT NULL DEFAULT 0,
      tokens_output INTEGER NOT NULL DEFAULT 0,
      request_count INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // 迁移：补齐旧表缺少的列
  try { db.exec("ALTER TABLE messages ADD COLUMN message_id TEXT DEFAULT ''") } catch { /* 列已存在 */ }
  try { db.exec("ALTER TABLE messages ADD COLUMN attachments TEXT DEFAULT ''") } catch { /* 列已存在 */ }

  return db;
}

// ── Helpers ───────────────────────────────────────────────────

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return (content as any[])
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("\n");
  }
  return JSON.stringify(content);
}

// ── Extension ──────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  let db: Database.Database | null = null;
  let conversationId: number | null = null;

  pi.on("session_start", async (_event, ctx) => {
    db = createDB();
    const sid = ctx.sessionManager.getSessionId();
    if (!sid) { console.warn("[pa-sqlite] session_id missing, skipping"); return; }
    const sfile = ctx.sessionManager.getSessionFile() ?? undefined;

    const existing = db.prepare("SELECT id FROM conversations WHERE session_id = ?").get(sid) as
      | { id: number }
      | undefined;

    if (existing) {
      conversationId = existing.id;
      db.prepare("UPDATE conversations SET updated_at = datetime('now','localtime') WHERE id = ?").run(
        conversationId,
      );
    } else {
      const result = db.prepare(
        "INSERT INTO conversations (session_id, session_file) VALUES (?, ?)",
      ).run(sid, sfile);
      conversationId = Number(result.lastInsertRowid);
    }
  });

  pi.on("message_end", async (event) => {
    if (!db || conversationId == null) return;

    const msg = event.message as Record<string, any>;
    const role = msg.role ?? "unknown";
    if (role === "tool" || role === "toolResult") return; // skip tool messages, keep only conversational messages

    const content = extractText(msg.content);
    if (!content.trim()) return;

    let tokensInput = 0;
    let tokensOutput = 0;
    if (role === "assistant" && msg.usage) {
      tokensInput = msg.usage.inputTokens ?? msg.usage.input ?? 0;
      tokensOutput = msg.usage.outputTokens ?? msg.usage.output ?? 0;
    }

    db.prepare(
      "INSERT INTO messages (conversation_id, role, content, tokens_input, tokens_output, model) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(conversationId, role, content, tokensInput, tokensOutput, msg.model ?? "");
  });

  pi.on("session_shutdown", async () => {
    if (db) {
      db.close();
      db = null;
      conversationId = null;
    }
  });

  // Register a command to query stats
  pi.registerCommand("pa-sessions", {
    description: "List SQLite-persisted sessions",
    handler: async (_args, ctx) => {
      if (!db) {
        ctx.ui.notify("pa-sqlite: database not initialized", "warning");
        return;
      }
      const rows = db.prepare(
        "SELECT id, title, session_id, created_at, updated_at FROM conversations ORDER BY updated_at DESC LIMIT 20",
      ).all() as any[];

      if (rows.length === 0) {
        ctx.ui.notify("No sessions in database", "info");
        return;
      }

      const lines = rows.map(
        (r) => `#${r.id} ${r.title} | ${r.updated_at?.slice(0, 16)}`,
      );
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });
}

import Database from 'better-sqlite3'
import path from 'path'
import os from 'os'
import fs from 'fs'

const PA_DIR = path.join(os.homedir(), '.personal-agent')
const DB_PATH = path.join(PA_DIR, 'agent.db')

let db: Database.Database | null = null

export function getDB(): Database.Database {
  if (!db) throw new Error('DB not initialized - call initDB() first')
  return db
}

export function initDB(): Database.Database {
  if (!fs.existsSync(PA_DIR)) fs.mkdirSync(PA_DIR, { recursive: true })

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

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

    CREATE TABLE IF NOT EXISTS tool_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      tool_call_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      input TEXT DEFAULT '',
      output TEXT DEFAULT '',
      status TEXT DEFAULT 'running',
      duration INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS context_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      used_tokens INTEGER NOT NULL DEFAULT 0,
      context_window INTEGER NOT NULL DEFAULT 0,
      percent REAL NOT NULL DEFAULT 0,
      model_id TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `)

  // 迁移：pa-sqlite 可能已创建 messages 表但缺少 message_id 列
  try { db.exec("ALTER TABLE messages ADD COLUMN message_id TEXT DEFAULT ''") } catch { /* 列已存在 */ }
  // 迁移：附件元数据持久化
  try { db.exec("ALTER TABLE messages ADD COLUMN attachments TEXT DEFAULT ''") } catch { /* 列已存在 */ }

  return db
}

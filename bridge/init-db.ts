import { initDB as _initDB, getDB } from './db'
import { generateUUID } from './protocol'

/**
 * 数据库初始化 + 主会话 + 默认设置
 * 幂等：重复调用不会覆盖已有数据
 */
export function initDB(): ReturnType<typeof _initDB> {
  const db = _initDB()
  console.log('[bridge] SQLite initialized at ~/.personal-agent/agent.db')

  // 确保主会话「澪」存在
  let mainSid = (db.prepare("SELECT value FROM settings WHERE key = 'main_session_id'").get() as { value: string } | undefined)?.value
  if (!mainSid) {
    mainSid = generateUUID()
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('main_session_id', ?)").run(mainSid)
    db.prepare("INSERT OR IGNORE INTO conversations (session_id, title) VALUES (?, '澪')").run(mainSid)
    console.log('[bridge] 主会话「澪」已创建:', mainSid)
  }

  // 初始化默认设置（首次运行）
  const settingsCount = (db.prepare("SELECT COUNT(*) as cnt FROM settings WHERE key NOT LIKE 'main_%'").get() as { cnt: number }).cnt
  if (settingsCount === 0) {
    const defaults: [string, string][] = [
      ['default_model', 'deepseek-v4-pro'],
      ['thinking_level', 'medium'],
      ['compact_threshold', '80'],
      ['history_retention', '100'],
      ['work_dir', ''],
      ['providers', JSON.stringify([{ id: 'deepseek', name: 'DeepSeek', apiKey: '', active: true }])],
      ['model_configs', '{}'],
    ]
    const insert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    for (const [k, v] of defaults) insert.run(k, v)
    console.log('[bridge] 默认设置已初始化')
  }

  return db
}

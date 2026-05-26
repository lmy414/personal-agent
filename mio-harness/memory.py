"""澪号记忆系统 — SQLite 存取 + 衰减权重检索"""

import sqlite3
import os
import re
from collections import Counter

DB = os.path.expandvars(r"%USERPROFILE%\.personal-agent\agent.db")


def ensure_table():
    conn = sqlite3.connect(DB)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS mio_memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            category TEXT DEFAULT 'user_fact',
            importance INTEGER DEFAULT 3,
            source_session TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_mio_mem_cat
        ON mio_memories(category)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_mio_mem_imp
        ON mio_memories(importance)
    """)
    conn.commit()
    conn.close()


def count_memories() -> int:
    conn = sqlite3.connect(DB)
    n = conn.execute("SELECT COUNT(*) FROM mio_memories").fetchone()[0]
    conn.close()
    return n


def search_memories(user_message: str, limit: int = 5) -> list:
    """根据用户消息提取关键词，检索相关记忆，带衰减权重"""
    keywords = _extract_keywords(user_message)
    if not keywords:
        return []

    like_clauses = " OR ".join(
        f"content LIKE '%{kw}%'" for kw in keywords[:10]
    )

    conn = sqlite3.connect(DB)
    sql = f"""
        SELECT content, category, importance,
               ROUND(importance * EXP(
                   -0.05 * (julianday('now') - julianday(updated_at))
               ), 2) AS weight
        FROM mio_memories
        WHERE {like_clauses}
        ORDER BY weight DESC
        LIMIT {limit}
    """
    rows = conn.execute(sql).fetchall()
    conn.close()

    return [
        {"content": r[0], "category": r[1], "importance": r[2], "weight": r[3]}
        for r in rows
    ]


def insert_memories(facts: list):
    """批量插入记忆"""
    conn = sqlite3.connect(DB)
    for f in facts:
        conn.execute(
            """INSERT INTO mio_memories (content, category, importance)
               VALUES (?, ?, ?)""",
            (f["content"], f.get("category", "user_fact"), f.get("importance", 3)),
        )
    conn.commit()
    conn.close()


def _extract_keywords(text: str, top_n: int = 10) -> list:
    """从文本中提取 CJK 2-4 字片段，按频率取前 N"""
    clean = re.sub(r"[^一-鿿]", "", text)
    if len(clean) < 2:
        return []

    segments = []
    for i in range(len(clean) - 1):
        for size in [2, 3, 4]:
            if i + size <= len(clean):
                segments.append(clean[i : i + size])

    return [kw for kw, _ in Counter(segments).most_common(top_n)]

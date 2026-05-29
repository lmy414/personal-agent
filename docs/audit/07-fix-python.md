# 代码审计修复代码：mio-harness Python 模块

## M. bridge.py stdin UTF-8

```python
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.stdin  = io.TextIOWrapper(sys.stdin.buffer,  encoding="utf-8")
```

## N. bridge.py 参数安全转换

```python
try:
    rounds = int(args[0]) if args else 0
except (ValueError, IndexError):
    rounds = 0
```

## O. bridge.py API 结构校验

```python
data = r.json()
try:
    content = data["choices"][0]["message"]["content"]
except (KeyError, IndexError, TypeError) as e:
    raise RuntimeError(f"Unexpected API response structure: {data}") from e
return content
```

## P. bridge.py SQLite 写入异常捕获

```python
try:
    insert_memories(facts)
    print(f"[pa-mio] 已提取 {len(facts)} 条记忆")
except Exception as e:
    print(f"[pa-mio] 记忆写入失败: {e}", file=sys.stderr)
```

## Q. memory.py 参数化查询

```python
def search_memories(keywords, limit=10):
    limit = min(max(int(limit), 1), 100)
    if not keywords: return []
    like_params = [f"%{kw}%" for kw in keywords[:10]]
    like_clauses = " OR ".join("content LIKE ?" for _ in like_params)
    sql = f"SELECT id, content, weight, created_at FROM mio_memories WHERE {like_clauses} ORDER BY weight DESC LIMIT ?"
    params = like_params + [limit]
    with sqlite3.connect(DB) as conn:
        rows = conn.execute(sql, params).fetchall()
    return [{"id": r[0], "content": r[1], "weight": r[2], "created_at": r[3]} for r in rows]
```

## R. memory.py 数据库目录预创建

```python
import os
DB_DIR = os.path.join(os.path.expanduser("~"), ".personal-agent")
DB = os.path.join(DB_DIR, "agent.db")

def ensure_table():
    os.makedirs(DB_DIR, exist_ok=True)
    with sqlite3.connect(DB) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS mio_memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                weight REAL DEFAULT 1.0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
```

## S. harness.py 字符文件读取容错

```python
def read(path):
    try:
        with open(path, encoding="utf-8") as f:
            return f.read().strip()
    except (FileNotFoundError, PermissionError) as e:
        print(f"[pa-mio] Warning: failed to read {path}: {e}", file=sys.stderr)
        return ""
```

## T. harness.py 加载 language.md

```python
"language_anchor": read(os.path.join(CHARS, "language.md")),
```

## U. test_counters.py dict 引用修复

```python
messages = [{"role": "user"} for _ in range(3)]
```

## V. show_flow.py 主入口保护

```python
if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    print(FLOW)
```

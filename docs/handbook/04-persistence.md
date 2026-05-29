# Personal Agent — 扩展开发手册：数据持久化

## 优先使用独立存储

| 存储方式 | 适用场景 | 优点 |
|----------|----------|------|
| **独立 JSON/文本文件** | 配置、缓存、简单状态 | 零耦合，随时可读 |
| **扩展专属 SQLite 表** | 结构化数据、查询需求 | schema 自治 |
| **共享 SQLite 数据库（新表）** | 需要与宿主或其他扩展共享的数据 | 统一备份 |

**禁止**：直接读写其他扩展的私有文件或表。

## 共享数据库使用约定

若必须使用共享数据库（`~/.personal-agent/agent.db`），遵守以下契约：

```typescript
// 1. 只操作自己创建的表
// 2. 表名加前缀，避免冲突
const MY_TABLE = "pa_hello_logs";

// 3. 建表时加 IF NOT EXISTS，不假设其他扩展已建表
db.exec(`
  CREATE TABLE IF NOT EXISTS ${MY_TABLE} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    content TEXT
  )
`);

// 4. 不删除/不修改其他扩展的表结构
```

## 文件存储位置

```typescript
import os from "os";
import path from "path";

// 推荐：扩展专属子目录
const EXT_DIR = path.join(os.homedir(), ".personal-agent", "pa-hello");
```

## 原子写入

```typescript
function atomicWrite(filePath: string, data: string) {
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, filePath);
}
```

---

**下一章**：
- 解耦通信 → `05-communication.md`

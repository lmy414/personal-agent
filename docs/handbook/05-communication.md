# Personal Agent — 扩展开发手册：解耦通信与共享模块

## 扩展间不直接调用

扩展之间**不直接调用**，通过以下方式间接协作：

### 1. 事件总线（推荐）

扩展 A 产生事件 → 宿主广播 → 扩展 B 监听。

但注意：**Pi 宿主目前不提供自定义事件广播 API**。扩展只能通过宿主预定义的事件（`message_end`, `agent_start` 等）间接感知其他扩展的行为。

### 2. 文件/数据库作为共享媒介（有限使用）

```
扩展 A 写入 ~/.personal-agent/shared-state.json
扩展 B 读取 ~/.personal-agent/shared-state.json
```

**约束**：
- 文件格式必须是稳定的（JSON Schema 版本化）
- 写操作应使用原子写入（先写临时文件再 rename）
- 不要假设其他扩展一定存在

### 3. 完全不通信（最佳）

大多数扩展应该独立运行，彼此无感知。例如 pa-usage 和 pa-budget 虽然共用 `usage_log` 表，但它们各自只关心自己的读写逻辑，不直接交互。

## 共享模块 (`extensions/shared/`) 使用规范

`shared/` 提供**稳定的、只读的、无状态的工具函数和常量**。当前包含：

| 模块 | 导出 | 说明 |
|------|------|------|
| `db-config.ts` | `PA_DIR`, `DB_PATH`, `USD_CNY_RATE`, `getPricing()` | 数据库路径和定价常量 |
| `counters.ts` | `HEDGE_WORDS` | 叠甲关键词列表 |
| `logger.ts` | `log/debug/info/warn/error`, `registerCheck()`, `close()` | 结构化诊断日志 |

**使用规则**：
- ✅ 可以 import shared 模块获取常量和工具函数
- ❌ 禁止修改 shared 模块的内部状态
- ❌ 禁止在 shared 模块中创建依赖特定扩展的逻辑

---

**下一章**：
- Checklist 与反模式 → `06-patterns.md`

# Personal Agent — 架构债务：扩展层

> 来源：2026-05-29 全项目代码审计  
> 关联：审计报告 `../audit/00-summary.md`，扩展手册 `../handbook/00-principles.md`

## 1. 数据库 Schema 隐式契约

### 问题

`pa-sqlite`、`pa-usage`、`pa-budget` 形成强隐式耦合：

- `pa-sqlite` 在 `session_start` 中创建 `messages`、`conversations`、`usage_log` 表
- `pa-usage` 直接向 `usage_log` 写入数据
- `pa-budget` 从 `usage_log` 读取数据计算成本

**风险**：若 `pa-sqlite` 加载失败或被移除，下游扩展静默失败；schema 变更无版本感知。

### 改进方向

1. **Schema 版本化**：每张共享表增加 `_schema_version` 字段或元数据表
2. **自包含建表**：每个扩展在 `session_start` 中用 `CREATE TABLE IF NOT EXISTS` 声明自己依赖的表，不假设其他扩展已执行
3. **表名前缀自治**：所有扩展的数据库表使用 `pa_<name>_*` 前缀，明确归属

## 2. pa-observe 内嵌 pa-mio 的计数器逻辑

### 问题

`pa-observe/index.ts` 复制了 `pa-mio` 的 `runCounters()` / `checkResponse()` 逻辑，违反 DRY 原则。修改计数规则需要改两处。

### 改进方向

1. **共享计数器引擎**：将计数器逻辑从 `pa-mio` 抽离到 `extensions/shared/counter-engine.ts`
2. **统一导入**：`pa-mio` 使用引擎做注入修正，`pa-observe` 使用同一引擎做观测记录
3. **配置驱动**：计数规则从硬编码改为 JSON 配置，扩展只读不写

## 3. pa-observe 硬编码 pa-mio 的实现细节

### 问题

`pa-observe` 的 subtitle 中出现 `"9 个 Slot 按序注入——元指令 → 身份层..."`，通用观察扩展不应知晓特定角色的 prompt 结构。

### 改进方向

- `pa-observe` 只记录原始 systemPrompt 字符串，不做语义解析
- 若需展示结构化信息，由 `pa-mio` 通过 `details` 字段或独立文件输出元数据

## 4. systemPrompt 链式拼接的不可预测性

### 问题

多个扩展监听 `before_agent_start` 并返回 `{ systemPrompt }`，宿主按加载顺序链式拼接。`pa-mio` 可能覆盖 `pa-observe` 的内容，顺序依赖导致行为不可预测。

### 改进方向

1. **Slot 化 systemPrompt**：宿主划分为 `header`、`identity`、`tools`、`footer` 等 Slot，扩展声明目标 Slot
2. **优先级权重**：扩展注册时声明 `priority: number`，高优先级后执行
3. **显式合并策略**：提供 `append`（追加）、`prepend`（前置）、`replace`（替换）三种模式

---

**相关文档**：
- 系统层债务 → `05-debt-system.md`
- 演进路线 → `06-roadmap.md`

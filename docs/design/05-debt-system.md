# Personal Agent — 架构债务：系统层

> 来源：2026-05-29 全项目代码审计  
> 关联：审计报告 `../audit/00-summary.md`

## 1. 进程模型：孤儿进程与 EPIPE

### 问题

`main.js` 和 `vendor/wgnr-pi/server.js` 均使用 `spawn(..., { shell: true })`。在 Windows 上：
- `SIGTERM` 只会终止 `cmd.exe`，子进程（pi-node / wgnr-pi）被孤儿化
- 路径中的特殊字符经过 `cmd.exe` 解析，存在命令注入风险
- `main.js` 的 `stdio` 将 stdout/stderr 双写到同一 `fs.WriteStream`，触发 `EPIPE` 崩溃

### 改进方向

1. 两处 `spawn` 均改为 `shell: false`
2. Windows 下使用 `taskkill /PID <pid> /T /F` 级联终止进程树
3. `main.js` 的 stdout/stderr 使用独立流，退出前显式 `end()`

## 2. 全局 wgnr-pi 与本地 vendor 的运行时漂移

### 问题

崩溃日志显示实际运行的是全局 npm 目录的 `wgnr-pi`，而非本地 `vendor/wgnr-pi/`。本地 patch 不生效。

### 改进方向

1. `main.js` 启动前校验实际加载的 `server.js` 绝对路径
2. 若检测到全局实例，强制终止并报警
3. 长期：本地 vendor 使用独立端口（如 4816），避免与全局实例冲突

## 3. 配置层：绝对路径与缺失依赖

### 问题

- `.pi/settings.json` 所有扩展路径写死为 `D:/claude/personal-agent/...`，可移植性为零
- `package.json` 缺少 Electron 依赖，依赖全局安装
- `pa.bat` 硬编码 `cd /d D:\claude\personal-agent`

### 改进方向

1. settings.json 使用相对路径，加载器基于自身目录 `path.resolve()`
2. `package.json` 添加 `"devDependencies": { "electron": "^33.0.0" }`
3. `pa.bat` 改为 `"%~dp0"`

## 4. 安全设计缺陷

### 问题

- 多处路径遍历：`pa-observe` 的 `traceKey()`、`pa-files` 的 `resolveSafe()`、`vendor` 的 Session API
- SQL 注入：`pa-usage` 的 `getStats()`、`mio-harness/memory.py`

### 改进方向

1. 所有用户输入的路径参数使用 `path.resolve()` + 大小写不敏感 `startsWith` 校验
2. `sessionId` 等标识符作为文件名前先做 `sha256` 哈希
3. REST API 的 ID 参数使用 `^[a-zA-Z0-9_-]+$` 白名单
4. 全部 SQL 使用参数化查询（`?` 占位符），禁止字符串拼接

## 5. 扩展生命周期：缺少 unload hook

### 问题

扩展工厂函数被调用一次即完成初始化，没有 `deactivate` / `unload` 钩子。热重载或退出时资源可能泄漏。

### 改进方向

1. 扩展工厂返回 `dispose` 函数：`return { dispose() { db.close(); } };`
2. 宿主在卸载前调用 `extension.dispose()`
3. 过渡方案：所有扩展在 `session_shutdown` 中清理资源

## 6. 共享层：缺少版本控制

### 问题

`shared/db-config.ts`、`logger.ts`、`counters.ts` 被多个扩展导入，但无版本号。修改函数签名会导致调用方静默失败。

### 改进方向

1. `shared/` 增加 `VERSION` 常量
2. 导出函数保持向后兼容（新增参数用可选参数或 options 对象）
3. 关键函数返回值使用明确接口而非 `any`

## 7. 数据持久化：共享文件竞争写入

### 问题

多个扩展读写同一 JSON 文件（如 `~/.personal-agent/` 下），没有锁机制或原子写入。

### 改进方向

1. 每个扩展的数据存放在专属子目录：`~/.personal-agent/pa-<name>/`
2. 写文件使用原子写入：`writeFileSync(tmp)` → `renameSync(tmp, target)`
3. 共享状态通过 SQLite 事务管理

---

**相关文档**：
- 扩展层债务 → `04-debt-extensions.md`
- 演进路线 → `06-roadmap.md`

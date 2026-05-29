# 代码审计：快速检查清单

修复后可按以下清单验证：

## 启动与进程

- [x] `pa.bat` 能在任意目录下双击启动（`%~dp0` 替代硬编码路径）
- [x] `npm install` 后无需全局 Electron 即可运行（`devDependencies` 已添加）
- [x] `.pi/settings.json` 使用相对路径，项目整体移动后扩展仍加载成功
- [x] 终止 Electron 时子进程（wgnr-pi、pi-node）同步退出，无孤儿进程（`before-quit` 优雅关闭 + `killPiTree`）
- [ ] `vendor/wgnr-pi/server.js` 崩溃日志中的堆栈显示本地 vendor 路径而非全局 npm 路径（需卸载全局 wgnr-pi 验证）

## 安全

- [x] `pa-usage /usage today` 等命令无法注入 SQL（白名单 + 静态 SQL map）
- [x] `pa-observe` 的 sessionId 经 UUID 格式校验，无法路径遍历
- [x] `pa-files /workspace C:\Windows` 被白名单拒绝（`ALLOWED_ROOTS`）
- [x] `pa-files /preview large.exe` 返回二进制提示而非尝试读取（扩展二进制防护列表）
- [x] Session API（restore/archive/delete）路径校验使用 `assertSafePath`（`resolve` + 大小写不敏感）
- [x] `observe_trace` API 的 sessionId 经 UUID 校验，非法格式返回 400
- [x] `memory.py` 使用参数化查询，无 SQL 注入风险

## 数据与编码

- [x] `mio-harness` 首次运行时自动创建 `~/.personal-agent/` 目录（`ensure_table` 中 `makedirs`）
- [ ] 向 `mio-harness` 发送中文消息无乱码（bridge.py stdin UTF-8 待修复）
- [ ] `pa-budget` 拒绝 `/budget set Infinity 100`（待修复）
- [ ] `pa-sqlite` 在 session_id 缺失时正确关闭 DB 连接（待修复）

## 稳定性

- [ ] `vendor/wgnr-pi` 在 pi 连续崩溃 10 次后停止自动重启（退避策略待修复）
- [ ] `main.js` 在服务器未启动时 25 秒后正确退出而非永久挂起（`waitForServer` 超时待修复）
- [ ] `pa-mio` 在 msg.content 包含循环引用时不崩溃（`safeStringify` 待修复）

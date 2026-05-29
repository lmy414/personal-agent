# 代码审计：快速检查清单

修复后可按以下清单验证：

## 启动与进程

- [ ] `pa.bat` 能在任意目录下双击启动
- [ ] `npm install` 后无需全局 Electron 即可运行
- [ ] `.pi/settings.json` 使用相对路径，项目整体移动后扩展仍加载成功
- [ ] 终止 Electron 时子进程（wgnr-pi、pi-node）同步退出，无孤儿进程
- [ ] `vendor/wgnr-pi/server.js` 崩溃日志中的堆栈显示本地 vendor 路径而非全局 npm 路径

## 安全

- [ ] `pa-usage /usage today` 等命令无法注入 SQL
- [ ] `pa-observe` 的 trace 文件名与用户输入的 sessionId 无直接对应关系
- [ ] `pa-files /workspace C:\Windows` 被白名单拒绝
- [ ] `pa-files /preview large.exe` 返回二进制提示而非尝试读取

## 数据与编码

- [ ] `mio-harness` 首次运行时自动创建 `~/.personal-agent/` 目录
- [ ] 向 `mio-harness` 发送中文消息无乱码
- [ ] `pa-budget` 拒绝 `/budget set Infinity 100`
- [ ] `pa-sqlite` 在 session_id 缺失时正确关闭 DB 连接

## 稳定性

- [ ] `vendor/wgnr-pi` 在 pi 连续崩溃 10 次后停止自动重启
- [ ] `main.js` 在服务器未启动时 25 秒后正确退出而非永久挂起
- [ ] `pa-mio` 在 msg.content 包含循环引用时不崩溃

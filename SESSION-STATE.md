# Personal Agent — 项目状态总览

> 最后更新：2026-05-29
> 当前阶段：v0.5.2 — Windows 路径兼容性修复，新会话侧边栏消失问题已解决

---

## 一、项目架构（已完成）

### Personal Agent 桌面应用

基于 Pi + DeepSeek + wgnr-pi + Electron 的个人 AI 助手平台。

```
Electron 窗口 → wgnr-pi Web UI → WebSocket → Pi RPC → DeepSeek API
                                ├── pa-sqlite (SQLite 持久化)
                                ├── pa-usage  (Token 用量追踪)
                                ├── pa-files  (工作区文件浏览)
                                └── pa-budget (API 预算预警)
```

**启动**：双击 `D:\claude\personal-agent\pa.bat`

**技术栈**：
- Pi v0.73.0 (MIT, Agent 循环 + 28 事件扩展系统)
- DeepSeek V3 + R1（配置在 `~/.pi/agent/models.json`）
- wgnr-pi 全中文 Web UI（`http://localhost:4815`）
- Electron 37.2.4 桌面壳 + 系统托盘
- 4 个自定义扩展 ~450 行 TypeScript
- Pi 配置文件：`D:\claude\personal-agent\.pi\settings.json`
- Pi 启动包装：`%APPDATA%\npm\pi-node.cmd`

**数据库**：
- Pi JSONL 会话：`~/.pi/agent/sessions/--D--claude-personal-agent--/`
- SQLite：`~/.personal-agent/agent.db`
- 旧 Electron 数据：`%APPDATA%/personal-agent/agent.db`（未迁移）

### wgnr-pi 魔改记录

修改了 `%APPDATA%\npm\node_modules\wgnr-pi/` 下三个文件：

1. **server.js**：
   - `spawn(PI_BIN, ...)` 加了 `shell: true`（Windows 兼容）
   - `parseSessions()` 路径编码正则改为 `replace(/[/\\:]/g, "-")` 匹配 Pi 的 `getDefaultSessionDir`
   - RPC 事件加了白名单过滤（`default: broadcast(data)` 改为只转发 10 个已知事件类型）
   - `/api/sessions` 加了日志

2. **public/index.html**（全中文汉化 + 多项修复）：
   - 全部 UI 文字中文化
   - `marked.setOptions` → `marked.use`（marked 18.x API 兼容）
   - `loadSessions()` 加了 localStorage 缓存保护（API 返回空时不覆盖已有列表）
   - `groupByDate` 标签引号修复（`label:"今天"` 不能漏引号）
   - `renderSessionList` 加了 try/catch
   - `applyMode` 对 `mode-pi` 加了 `?.` 空检查
   - JS 函数名 `toggleArchived` / `loadArchivedSessions` 从 replace_all 误伤中恢复
   - `catch { // keep current list }` 注释吞括号修复 → `/* keep current list */ }`

### Electron 壳

`D:\claude\personal-agent\main.js`（95 行）：
- spawn wgnr-pi → 等 HTTP 200 → 加载 `http://127.0.0.1:4815`
- F12 打开 DevTools（Menu Accelerator + before-input-event 双保险）
- 关闭窗口 → 最小化到托盘（Tray）
- 退出时 kill 子进程

---

## 二、澪号项目 — 数据收集状态

### 目标

创建一个名为**澪号**的独立 AI 角色：
- 性别女，已成年，外观待定
- 从 Mirror 的个人数据中提取语言风格、知识背景、价值观作为"成长环境"
- 不是 Mirror 的数字分身——是完全独立的新人格
- 继承 Mirror 的知识领域和语言环境，但性格、偏好、行为模式都是自己的

### 已收集数据

| 来源 | 文件 | 内容 |
|------|------|------|
| GitHub | `mio-data/github-analysis.md` | 15 个仓库分析、代码风格、技术栈 |
| 知乎 | `mio-data/zhihu-profile.md` | 个人主页元数据 |
| 知乎 | `mio-data/zhihu-articles.md` | Cesium3DTile 源码注释文章 |
| B站 | `mio-data/bilibili-profile.md` | 个人主页 + MMD 视频分析 |
| B站 | `mio-data/bilibili-content.md` | 专栏文章（Blender NPR 教程）+ 收藏夹分析 |
| 网易云 | `mio-data/music-profile.md` | 946 首"我喜欢"歌单 + 音乐人格分析 |
| 网易云 | `mio-data/songs-liked.txt` | 清洗后的完整歌单 |
| QQ 私聊 | `mio-data/qq-chat-analysis.md` | 私聊 4852 条：亲密关系中的 Mirror |
| QQ 私聊 | `mio-data/qq-language-fingerprint.md` | 全量语言指纹（词汇/标点/句长/表情/时段） |
| 综合 | `mio-data/profile-overview.md` | 跨平台人格速写 |
| 综合 | `mio-data/writing-style.md` | 小说创作风格分析 |
| 综合 | `mio-data/data-inventory.md` | 数据清单 + 质量评估 |

### QQ 群聊（✅ 分析完成）

| 群 | Mirror 身份 | Mirror 发言 | 状态 |
|------|------|------|------|
| **1034791447** — 人类工程灾后重建计划 | 夏目安安（希儿） | 8,727 | ✅ 已分析 |
| **🦐🍐退休闲散人员交流部** | 夏目安安 | 3,577 | ✅ 已分析 |
| **921932191**（游戏公会） | 希儿世界第一可爱 | 2,064 | ✅ 已分析 |
| **873351992** — 二次元交流 | 希儿 | 608 | ✅ 已分析 |
| **879317594** — 210(WebGIS) | 希儿 | 20 | ✅ 已分析 |
| **Free Bird 群** | — | — | 尚未导出！ |

**QQ 数据本地路径**：`%USERPROFILE%\.qq-chat-exporter\exports\`

**分析产出**（`mio-data/` 下）：
- 5 个单群分析报告（`group-*-analysis.md` + `.json`）
- 1 个跨群对比报告（`group-cross-comparison.md`）
- 1 个综合分析报告（`group-chat-synthesis.md`）
- 分析脚本：`D:\claude\personal-agent\analyze_groups.py`

### 关键发现

1. **公开 vs 私下的双重人格**：
   - 公开（知乎/B站/GitHub）：叠甲、潜水、技术化、不表达情感
   - 私下（QQ 私聊）：温柔、细腻、焦虑、会说"喵"和"摸摸"

2. **语言指纹**（来自 QQ 私聊 4852 条分析）：
   - 65% 消息 ≤10 字，短句+逗号拼接
   - "hhh"（51次）不是"哈哈哈"；空白括号（）42次是核心吐槽符号
   - 几乎不用感叹号（4次）和 emoji
   - "嗯嗯" 不是 "嗯"；"晚安了喵" 是晚安仪式
   - "草了"/"南蚌"/"没招了"——温和的吐槽词汇

3. **叠甲仅在公开场合出现**：私聊中 Mirror 不叠甲

4. **群聊 vs 私聊的语言断层**（新增，来自 14,996 条群聊分析）：
   - hhh（51次→1次）、嗯嗯（59次→6次）、空括号（42次→32次）——亲昵标记在群聊几乎消失
   - 问号（25→293）、感叹号（4→127）——群聊中的 Mirror 更具辩论性
   - "有一说一"（2→38）——群聊中的公平标记替代了私聊中的叠甲
   - 消息长度跨场景稳定（~22字），但情感密度完全不同

5. **音乐人格**：VOCALOID 是底层操作系统、崩坏3 是情感锚点、Mili 是灵魂共鸣

---

## 三、澪号角色卡 v1.1

文件：`mio-data/character-v1.md`

当前版本包含：
- 基础信息 + 成长环境
- 核心性格（外冷内热、技术自信、偶尔毒舌、低电量社交、括号吐槽）
- Mirror vs 澪号对比表（新增：亲密模式对比）
- 知识领域（精通/熟悉/了解三级）
- 音乐人格
- **语言风格（v1.1 新增：句长节奏、标点系统、亲密语言标记、通用语言标记、示例）**
- 行为准则（会做/不会做/边界）

**v1.1 主要更新**：
- QQ 私聊语言指纹（hhh/嗯嗯/空括号/摸摸/晚安了喵）
- QQ 群聊分析（14,996条，5个群）
- 群聊 vs 私聊双重行为模式
- 亲密标记 vs 通用标记的区分

---

## 四、澪号 Harness 系统（2026-05-27 部署）

### 架构

基于 Harness Engineering（驾驭工程）理念设计的角色控制系统：

```
wgnr-pi → Pi → pa-mio 扩展（TypeScript）
                   ├── before_agent_start → 组装澪号 Prompt → 替换 systemPrompt
                   ├── message_end → 5 个计数器检查（叠甲/emoji/感叹号/话痨/亲密溢出）
                   ├── tool_execution_start/end → 工具执行进度反馈
                   ├── agent_end → 记忆提取（DeepSeek 独立调用 → JSON 文件）
                   └── session_start → 重置状态
```

**Prompt 注入顺序**（9 个 Slot）：
```
Slot 0: meta_instruction（身份 > 工具）
Slot 1: soul + boundaries（身份层）
Slot 2: knowledge（知识层）
Slot 3: [运行环境] Pi 原生提示词 + 工具定义
Slot 4: 记忆层（JSON 文件检索）
Slot 5: Chat History（Pi 管理）
Slot 6: 语言锚（50 tokens，最靠近输出）
Slot 7: 修正槽（计数器触发时注入）
Slot 8: 用户消息
```

**关键设计**：
- Pi 原生提示词退化为 Slot 3 内的 `[运行环境]` 标签，不再作为独立 SYSTEM 块与澪号身份竞争
- 工具层在身份层之后——身份先立住，工具后补充
- 语言锚在 chat history 之后、用户消息之前——最靠近输出，注意力权重最高
- 长工具返回（>500字）时自动在 history 前额外插入语言锚，对抗稀释

### 文件

| 文件 | 用途 |
|------|------|
| `mio-harness/character/soul.md` | 人格叙事 + 外观（163cm 灰发红瞳双马尾）+ 傲娇对话示例 |
| `mio-harness/character/boundaries.md` | 硬边界 |
| `mio-harness/character/language.md` | 语言指纹 |
| `mio-harness/character/knowledge.md` | 领域知识 |
| `mio-harness/meta_instruction.txt` | Slot 0 元指令 |
| `mio-harness/tools_stub.txt` | Slot 3 工具层占位 |
| `extensions/pa-mio/index.ts` | Pi 扩展（零外部依赖，纯 TypeScript） |

### 记忆系统

- 存储：`~/.personal-agent/mio_memories.json`（最多 500 条）
- 检索：CJK 2-4 字片段提取关键词 → 匹配 → 衰减权重排序 `importance × e^(-0.05 × 天数)`
- 提取：对话结束后独立 DeepSeek API 调用（不受澪号人格限制）
- 触发条件：对话 >10 条消息 + 尚未提取过

### wgnr-pi 修改（Git 跟踪）

wgnr-pi (`%APPDATA%\npm\node_modules\wgnr-pi`) 已纳入 Git 管理：

| Commit | 变更 |
|--------|------|
| `0627584` | 原始 npm 安装版本 |
| `b6a769f` | history 事件渲染 toolCall + toolResult 消息 |
| `c5cd68e` | 工具块包裹 .msg 容器（CSS 修复） |
| `9475e6b` | 修复目录列表双换行 bug（移除冗余 `<br>`，history 路径加 `pre-wrap`） |
| *未提交* | 全中文汉化 + marked.use API 兼容 + localStorage 缓存保护 + 多项 UI 修复 |
| *未提交* | **流水线透视面板** — 新增 pa-observe 扩展 + wgnr-pi 调试面板 CSS/HTML/JS + /api/observe_trace 端点 |

---

## 四-B、流水线透视面板（2026-05-27 新增，2026-05-28 修复）

### v0.4.1 BUG 修复（2026-05-28）

修复了 4 个会话切换相关的 BUG，详见 `docs/observe-issues.md`。

**核心改动**：
- pa-observe `session_start` 捕获 `sessionFile`/`sessionId` 写入 trace JSON
- API 匹配 key 从 `sessionId`(UUID) 改为 `sessionFile`(路径精确匹配)
- 前端 `fetchObserveTrace` 快照 `currentSessionFile`，`await` 后校验（竞态守卫）
- server GET/POST 均校验 `trace.sessionFile === requestSessionFile`
- `session_state` 切换时重置时间戳 + 清空面板 DOM

**修改文件**：
| 文件 | 改动 |
|------|------|
| `extensions/pa-observe/index.ts` | +6 行：sessionFile/sessionId 捕获与写入 |
| `wgnr-pi/server.js` | ~40 行重写：sessionFile 过滤 + POST 守卫 + 日志 |
| `wgnr-pi/public/index.html` | +10 行：sessionFile 参数 + 竞态守卫 + 面板清空 |

### 功能

右侧可展开的调试面板，展示每轮 Agent 对话的完整内部流水线——从 Prompt 组装到 API 调用到工具执行到计数器检查。

### 数据链路

```
pa-observe (Pi 扩展) → 写入 observe_last_trace.json
                       ↓
wgnr-pi /api/observe_trace → 前端 fetch → renderTrace()
```

不使用 WebSocket 推送，改用文件 + HTTP 轮询（打开面板后每 3 秒拉取），避免 RPC 事件转发兼容性问题。

### 7 个追踪步骤

| # | 步骤 | 数据来源 | 内容 |
|---|------|---------|------|
| 1 | System Prompt 组装 | `before_agent_start` | 组装后的完整 systemPrompt（含澪号 9-Slot） |
| 2 | Context 消息列表 | `context` | 发给 LLM 前的消息数组摘要 |
| 3 | API 请求体 | `before_provider_request` | DeepSeek 完整 HTTP 请求 JSON（含 messages/tools/temperature） |
| 4 | API 响应 | `after_provider_response` | HTTP 状态码 |
| 5 | 工具调用 | `tool_execution_start/end` | 工具名、参数、返回值、耗时 |
| 6 | 计数器检查 | `message_end` | 5 项规则检查（叠甲/emoji/感叹号/话痨/亲密溢出）+ 修正槽注入 |
| 7 | 记忆提取 | `agent_end` | 由 pa-mio 处理，pa-observe 仅报告状态 |

### 涉及的文件

| 文件 | 改动 |
|------|------|
| `extensions/pa-observe/index.ts` | **新建** ~308 行，Hook 8 个 Pi 事件，写 JSON 到 `~/.personal-agent/observe_last_trace.json` |
| `wgnr-pi/public/index.html` | CSS +150 行 / HTML +10 行 / JS +120 行（面板 UI + 渲染 + 轮询） |
| `wgnr-pi/server.js` | 新增 `GET /api/observe_trace` 端点（~10 行） |
| `.pi/settings.json` | extensions 数组新增 pa-observe |

### 面板 UI

- 位置：`position: fixed; right: 0; top: 0; bottom: 0; width: 420px`
- 开关：右侧边缘 `🔍 流水线` 竖排按钮
- 展开/折叠：每个步骤点击标题切换
- 滚动：面板整体 `overflow-y: scroll`，无步骤内独立滚动条
- 默认折叠所有步骤，API 请求体（Step 3）默认展开
- 配色沿用项目统一的深蓝主题（--bg / --surface / --accent）

---

## 五、后续路线

### 短期
- [x] 分析五个 QQ 群聊的 Mirror 发言 → 14,996条，7个产出文件 ✅
- [x] 更新澪号角色卡 v1.1（融入 QQ 私聊+群聊数据）✅
- [x] 创建 pa-mio 扩展（Harness 角色控制 + 记忆系统）✅
- [x] 澪号 System Prompt（Harness 注入管线）✅
- [x] wgnr-pi 历史工具渲染修复 ✅
- [x] 流水线透视面板（pa-observe + Debug 面板 UI） ✅
- [ ] 导出 Free Bird 群数据

### 中期
- [ ] wgnr-pi 角色选择面板
- [ ] 外观设计落实（163cm 灰发红瞳双马尾）
- [ ] Harness 自动重试闭环（计数器触发 → 修正 → 重新生成）
- [ ] 长时间运行验证（记忆膨胀、角色漂移、token 成本）

### 长期
- [ ] 记忆检索升级（SQLite → Vector）
- [ ] 多角色切换
- [ ] 澪号立绘/Live2D

---

## 六、常见重启命令

```bash
# 启动桌面应用
cd D:\claude\personal-agent && taskkill //F //IM electron.exe 2>&1; taskkill //F //IM node.exe 2>&1; sleep 2 && electron .

# 删除临时文件
rm D:/claude/personal-agent/qq_analyze.js D:/claude/personal-agent/qq_deep_analyze.js D:/claude/personal-agent/find_mirror.js D:/claude/personal-agent/group_identity.js 2>/dev/null
```

## 七、文件索引

| 文件 | 用途 |
|------|------|
| `personal-agent/README.md` | 项目说明 |
| `personal-agent/ROADMAP.md` | 路线图 |
| `personal-agent/DESIGN.md` | 设计文档 |
| `personal-agent/PROJECT.md` | 项目总览 |
| `personal-agent/TEST_CHECKLIST.md` | 测试清单 |
| `personal-agent/SESSION-STATE.md` | 项目状态总览（本文件） |
| `personal-agent/pa.bat` | 一键启动 |
| `personal-agent/.pi/settings.json` | Pi 配置 |
| `personal-agent/main.js` | Electron 入口 |
| `personal-agent/extensions/pa-sqlite/index.ts` | SQLite 扩展 |
| `personal-agent/extensions/pa-usage/index.ts` | 用量追踪扩展 |
| `personal-agent/extensions/pa-files/index.ts` | 文件浏览扩展 |
| `personal-agent/extensions/pa-budget/index.ts` | 预算预警扩展 |
| `personal-agent/extensions/pa-mio/index.ts` | 澪号 Harness 扩展 |
| `personal-agent/extensions/pa-observe/index.ts` | 流水线透视扩展（v0.4.0 新增） |
| `personal-agent/skills/personal-agent/agent.md` | Agent Skill |
| `personal-agent/mio-harness/character/` | 角色文件（soul/boundaries/knowledge/language） |
| `personal-agent/mio-data/character-v1.md` | 澪号角色卡 v1.1 |
| `personal-agent/mio-data/analysis/` | 平台分析报告（10 个） |
| `personal-agent/mio-data/design/` | 设计文档档案（11 个） |
| `personal-agent/mio-data/groups/` | 群聊分析（5 群 + 跨群对比） |
| `personal-agent/mio-data/scripts/` | 分析脚本（9 个，已归档） |
| `~/.pi/agent/models.json` | DeepSeek 配置 |
| `~/.personal-agent/agent.db` | SQLite 数据库 |
| `~/.personal-agent/mio_memories.json` | 澪号记忆存储 |

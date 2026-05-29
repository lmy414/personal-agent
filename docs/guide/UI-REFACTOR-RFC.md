# UI 组件化重构 RFC

> **状态**: 进行中  
> **目标文件**: `vendor/wgnr-pi/public/index.html`（1746 行单文件）  
> **重构方式**: 零框架原生 JS，ES Module 拆分  
> **核心原则**: 每个组件只依赖后端 WebSocket，不依赖其他前端组件

---

## 1. 为什么要重构

### 1.1 当前问题

`vendor/wgnr-pi/public/index.html` 是一个 **1746 行的单文件应用**：

- HTML 结构 + 511 行 CSS + ~1200 行 JS 全部内联
- 零框架，命令式 DOM 操作
- `handleEvent()` 是一个 **250+ 行的巨型 switch**，直接操作全局 DOM 和全局变量
- 状态与视图紧耦合，无中间层
- 无法单元测试，无法复用，团队协作冲突频繁

### 1.2 重构目标

| 目标 | 当前 | 重构后 |
|------|------|--------|
| 文件大小 | 1746 行单文件 | 9 个组件文件，每个 < 200 行 |
| 依赖关系 | 全局变量互相引用 | 零组件间引用 |
| 测试 | 无法单元测试 | 每个组件可独立测试 |
| 复用 | 不可复用 | 任意组件可移植 |
| 维护 | 改一处影响全局 | 改一个组件不影响其他 |

---

## 2. 通信架构（保持不变）

### 2.1 连接链路

```
浏览器 (index.html)  ←──WebSocket──→  server.js  ←──JSON-RPC──→  pi --mode rpc
     ws://host:4815/ws                    port 4815
```

### 2.2 前端 → 后端（WebSocket 消息类型）

| type | 参数 | 说明 |
|------|------|------|
| `prompt` | `text`, `images?` | 发送消息 |
| `abort` | — | 中止生成 |
| `new_session` | — | 新建会话 |
| `switch_session` | `sessionPath` | 切换会话 |
| `load_history` | — | 加载历史 |
| `set_model` / `cycle_model` | `provider`, `modelId` | 设置/切换模型 |
| `set_thinking_level` / `cycle_thinking_level` | `level` | 设置/切换思考级别 |
| `get_models` / `get_stats` | — | 获取模型列表/统计 |
| `export_request` | — | 导出会话 |

### 2.3 后端 → 前端（广播消息类型）

| type | 数据 | 说明 |
|------|------|------|
| `status` | `busy`, `piConnected`, `aborted?` | 状态更新 |
| `pi_health` | `connected` | Pi 进程健康 |
| `error` | `message` | 错误提示 |
| `commands` | `commands[]` | 可用命令列表 |
| `available_models` | `models[]` | 可用模型列表 |
| `session_state` | `sessionFile`, `sessionId`, `model`, `thinkingLevel` | 会话状态 |
| `model_state` | `model`, `thinkingLevel` | 模型状态变更 |
| `session_stats` | `stats` | 会话统计 |
| `session_switched` | — | 会话已切换 |
| `session_reset` | — | 会话已重置 |
| `history` | `messages[]` | 历史消息 |
| `agent_start` / `agent_end` | — | Agent 开始/结束 |
| `message_start` / `message_update` / `message_end` | `message`, `assistantMessageEvent` | 消息流式 |
| `tool_execution_start` / `tool_execution_end` | `toolName`, `toolCallId`, `result` | 工具执行 |
| `export_response` | `session` | 导出数据 |

---

## 3. 组件化架构

### 3.1 核心设计原则

1. **零组件间引用**: A 组件不 `import` B 组件，不读取 B 的 DOM
2. **事件驱动**: 组件通过 `EventBus` 发布/订阅事件通信
3. **自包含渲染**: 每个组件管理自己的 DOM 创建、更新、销毁
4. **独立 API 调用**: 需要数据时直接调后端，不通过其他组件

### 3.2 架构图

```
┌─────────────────────────────────────────┐
│  EventBus (全局事件总线，极简实现)         │
├─────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ Header  │  │ Sidebar │  │ ChatArea│ │  ← 独立组件，只订阅/发布事件
│  │ Component│  │Component│  │Component│ │
│  └────┬────┘  └────┬────┘  └────┬────┘ │
│       └─────────────┴─────────────┘     │
│              通过 EventBus 通信           │
├─────────────────────────────────────────┤
│  WsService (唯一与后端通信的入口)          │
│  ws.send() / fetch() — 直接对接后端        │
└─────────────────────────────────────────┘
```

### 3.3 组件清单

| 组件 | 职责 | 订阅事件 | 发布事件 | 调用 WsService |
|------|------|----------|----------|----------------|
| **Header** | 顶部状态栏、模型标签、工具按钮 | `ws:status`, `ws:pi_health`, `ws:model_state` | `action:clear`, `action:help`, `action:export`, `action:abort` | `abort()`, `exportRequest()` |
| **Sidebar** | 会话列表、新建聊天、归档 | `ws:session_state`, `ws:session_switched`, `ws:history` | `session:switch`, `session:new`, `session:archive`, `session:delete`, `session:rename` | `switchSession()`, `newSession()` |
| **ChatArea** | 消息列表、流式渲染 | `ws:history`, `ws:message_start`, `ws:message_update`, `ws:message_end`, `ws:agent_start` | — | 无（纯展示） |
| **InputBox** | 输入框、图片预览、命令补全 | `ws:commands`, `ws:status` | `message:sent` | `prompt()` |
| **ModelPicker** | 模型选择弹窗 | `ws:available_models`, `ws:model_state` | `model:select` | `setModel()`, `cycleModel()` |
| **StatsBar** | Token/成本统计 | `ws:session_stats` | — | `getStats()` |
| **HealthBanner** | Pi 断开提示 | `ws:pi_health`, `ws:status` | — | 无（纯展示） |
| **DebugPanel** | 流水线透视 | `ws:message_start` (observe_trace) | `trace:poll` | `fetch('/api/observe_trace')` |

---

## 4. 文件结构

```
vendor/wgnr-pi/public/
├── index.html              # 纯模板，只留容器 div
├── css/
│   └── styles.css          # 全部样式（从原 index.html 提取）
├── js/
│   ├── app.js              # 入口，组装组件
│   ├── event-bus.js        # 事件总线
│   ├── utils/
│   │   └── markdown.js     # md() + esc()
│   ├── services/
│   │   └── ws-service.js   # WebSocket 封装
│   └── components/
│       ├── chat-area.js
│       ├── input-box.js
│       ├── header.js
│       ├── sidebar.js
│       ├── stats-bar.js
│       ├── health-banner.js
│       ├── debug-panel.js
│       └── model-picker.js
```

---

## 5. 核心模块实现

### 5.1 EventBus（event-bus.js）

```javascript
class EventBus {
  constructor() {
    this.events = {};
  }
  on(event, handler) {
    (this.events[event] ||= []).push(handler);
    return () => this.off(event, handler);
  }
  off(event, handler) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(h => h !== handler);
  }
  emit(event, data) {
    (this.events[event] || []).forEach(h => h(data));
  }
}
export const bus = new EventBus();
```

### 5.2 WsService（services/ws-service.js）

```javascript
import { bus } from '../event-bus.js';

class WsService {
  constructor() {
    this.ws = null;
    this.reconnectTimer = null;
    this.connect();
  }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${proto}//${location.host}/ws`);

    this.ws.onopen = () => {
      bus.emit('ws:connected');
      this.send({ type: 'get_models' });
      this.send({ type: 'load_history' });
    };

    this.ws.onclose = () => {
      bus.emit('ws:disconnected');
      this.reconnectTimer = setTimeout(() => this.connect(), 2000);
    };

    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        bus.emit(`ws:${data.type}`, data);
      } catch (err) {
        console.error('[WS] Parse error:', err);
      }
    };
  }

  send(data) {
    if (this.ws?.readyState === 1) {
      this.ws.send(JSON.stringify(data));
    }
  }

  prompt(text, images) {
    this.send({ type: 'prompt', text, ...(images && { images }) });
  }
  abort() { this.send({ type: 'abort' }); }
  newSession() { this.send({ type: 'new_session' }); }
  switchSession(sessionPath) { this.send({ type: 'switch_session', sessionPath }); }
  loadHistory() { this.send({ type: 'load_history' }); }
  setModel(provider, modelId) { this.send({ type: 'set_model', provider, modelId }); }
  cycleModel() { this.send({ type: 'cycle_model' }); }
  cycleThinkingLevel() { this.send({ type: 'cycle_thinking_level' }); }
  getModels() { this.send({ type: 'get_models' }); }
  exportRequest() { this.send({ type: 'export_request' }); }
}

export const wsService = new WsService();
```

### 5.3 Markdown 工具（utils/markdown.js）

```javascript
export function md(text) {
  if (!text) return '';
  return DOMPurify.sanitize(marked.parse(text, { async: false }));
}

export function esc(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
```

---

## 6. 组件实现规范

### 6.1 组件模板

```javascript
// components/xxx.js
import { bus } from '../event-bus.js';
import { wsService } from '../services/ws-service.js';

export class XxxComponent {
  constructor(container) {
    this.container = container;
    this.render();
    this.bindEvents();
  }

  render() {
    // 创建 DOM 结构
    this.container.innerHTML = `...`;
    // 缓存 DOM 引用
    this.xxxEl = this.container.querySelector('#xxx');
  }

  bindEvents() {
    // 订阅事件
    this.unsubs = [
      bus.on('ws:xxx', (data) => this.onXxx(data)),
    ];
    // 绑定 DOM 事件
    this.xxxEl.onclick = () => this.onClick();
  }

  onXxx(data) {
    // 更新自己的 DOM
  }

  onClick() {
    // 直接调后端，或发布事件
    wsService.xxx();
    bus.emit('xxx:yyy', data);
  }

  destroy() {
    this.unsubs.forEach(fn => fn());
    this.container.innerHTML = '';
  }
}
```

### 6.2 关键规则

1. **构造函数只接收 `container`**: 不接收其他组件实例
2. **`render()` 创建完整 DOM**: 不假设外部已有某些元素
3. **`bindEvents()` 订阅 + DOM 事件**: 所有事件集中在这里
4. **`destroy()` 取消订阅 + 清空 DOM**: 防止内存泄漏
5. **不操作外部 DOM**: 只操作 `this.container` 内的元素
6. **不读取全局变量**: 只通过事件接收数据

---

## 7. 迁移步骤

### 7.1 阶段一：基础设施（P0）

1. 创建目录结构 `css/`, `js/utils/`, `js/services/`, `js/components/`
2. 提取 `event-bus.js`
3. 提取 `ws-service.js`
4. 提取 `markdown.js`
5. 重写 `index.html` 为纯模板
6. 提取 `styles.css`

### 7.2 阶段二：核心组件（P0）

7. 提取 `chat-area.js`（最复杂，消息流式渲染）
8. 提取 `input-box.js`（输入框 + 命令补全 + 图片）

### 7.3 阶段三：辅助组件（P1）

9. 提取 `header.js`
10. 提取 `sidebar.js`
11. 提取 `stats-bar.js`
12. 提取 `health-banner.js`

### 7.4 阶段四：高级组件（P2）

13. 提取 `debug-panel.js`（流水线透视）
14. 提取 `model-picker.js`（模型选择弹窗）

### 7.5 阶段五：验证（P0）

15. 编写 `app.js` 入口
16. 验证所有功能正常
17. 清理旧代码

---

## 8. 风险与回退

| 风险 | 缓解措施 |
|------|----------|
| 重构中断 | 每个阶段独立可运行，随时可回退到上一阶段 |
| 功能遗漏 | 对照原 `handleEvent` switch 逐项检查 |
| 性能退化 | 保持 `requestAnimationFrame` 滚动，避免频繁 DOM 操作 |
| 浏览器兼容 | 使用原生 ES Module，现代浏览器均支持 |

**回退策略**: 保留原 `index.html` 为 `index.html.bak`，随时可恢复。

---

## 9. 验证清单

- [ ] WebSocket 连接正常
- [ ] 消息发送/接收正常
- [ ] 流式渲染正常
- [ ] 图片粘贴/发送正常
- [ ] 命令补全正常
- [ ] 会话切换正常
- [ ] 模型切换正常
- [ ] 流水线面板正常
- [ ] 导出功能正常
- [ ] 移动端响应式正常

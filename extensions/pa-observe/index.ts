/**
 * pa-observe — 流水线透视扩展，收集每轮 Agent 对话的完整追踪数据
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import fs from "fs";
import path from "path";
import os from "os";

// ── 计数器逻辑（与 pa-mio 一致） ──────────────────────
const HEDGE_WORDS = [
  "我觉得可能", "大概是吧", "也许是吧", "应该是吧",
  "我也不太确定", "可能不太对", "我也不是很懂",
];

interface CounterResult {
  name: string;
  passed: boolean;
  detail: string;
}

function runCounters(text: string, roundCount: number): { results: CounterResult[]; correction: string | null } {
  const results: CounterResult[] = [];

  const hedgeCount = HEDGE_WORDS.filter(w => text.includes(w)).length;
  results.push({ name: "叠甲", passed: hedgeCount < 2, detail: `检测 ${hedgeCount} 个关键词` });

  const emojiCount = (text.match(/[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}☀-➿⭐❤]/gu) || []).length;
  results.push({ name: "emoji 溢出", passed: emojiCount < 3, detail: `${emojiCount} emoji` });

  const exclaim = (text.match(/[！!]/g) || []).length;
  results.push({ name: "感叹号", passed: exclaim < 2, detail: `${exclaim} 个` });

  const tooLong = text.length > 200;
  results.push({ name: "话痨", passed: !tooLong, detail: `${text.length} 字 / 阈值 200` });

  let correction: string | null = null;
  if (hedgeCount >= 2) correction = "你不需要叠甲。有观点直接说。不确定就说'不确定，我查一下'。";
  else if (emojiCount >= 3) correction = "你几乎不使用 emoji。文字本身就够了。";
  else if (exclaim >= 2) correction = "你几乎不用感叹号。你不是在生气，你只是在说话。";
  else if (tooLong) correction = "短句。你刚才太啰嗦了。";
  else if (roundCount < 10) {
    for (const sig of ["hhh", "嗯嗯", "摸摸"]) {
      if (text.includes(sig)) {
        results.push({ name: "亲密溢出", passed: false, detail: `检测到 ${sig}` });
        correction = "hhh和嗯嗯是你在信任的人面前才会用的。现在你们还不够熟。";
        break;
      }
    }
  }
  if (roundCount >= 10 && !correction) {
    results.push({ name: "亲密溢出", passed: true, detail: `第 ${roundCount} 轮 · 无亲密标记` });
  }

  return { results, correction };
}

// ── 截断工具 ─────────────────────────────────────────
function trunc(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + `\n... (截断，原 ${s.length} 字符)`;
}

// ── 注册 ────────────────────────────────────────────
export default function register(api: ExtensionAPI) {
  console.log("[pa-observe] 流水线透视已加载");

  let turnIndex = 0;
  let roundCount = 0;
  let stepData: Record<string, any> = {};
  // 在执行开始前累积数据
  let promptSystem = "";
  let contextMsgs: any[] = [];
  let providerPayload: unknown = null;
  let providerStatus = 0;
  let toolCalls: any[] = [];
  let toolStartTimes: Record<string, number> = {};
  let lastAssistantContent = "";

  function reset() {
    stepData = {};
    promptSystem = "";
    contextMsgs = [];
    providerPayload = null;
    providerStatus = 0;
    toolCalls = [];
    toolStartTimes = {};
    lastAssistantContent = "";
  }

  function sendTrace() {
    const steps: any[] = [];

    // Step 1: Prompt 组装
    if (promptSystem) {
      steps.push({
        id: "prompt", title: "System Prompt 组装", icon: "prompt",
        badge: "✓", badgeType: "ok",
        subtitle: "9 个 Slot 按序注入——元指令 → 身份层（soul+boundaries）→ 知识层 → 运行环境 → 记忆 → 语言锚。Pi 原生提示词退化为 Slot 3 内的 [运行环境] 标签。",
        meta: [
          { k: "总长", v: `${promptSystem.length} chars` },
          { k: "含标签", v: "Slot 0·1·2·3·6" },
        ],
        detail: { type: "prompt", fullText: trunc(promptSystem, 4096) },
      });
    }

    // Step 2: Context 消息列表
    if (contextMsgs.length) {
      const counts: Record<string, number> = {};
      for (const m of contextMsgs) {
        const r = m.role || "unknown";
        counts[r] = (counts[r] || 0) + 1;
      }
      const meta = [{ k: "消息数", v: `${contextMsgs.length} 条` }];
      for (const [role, n] of Object.entries(counts)) {
        meta.push({ k: role, v: `${n}` });
      }
      steps.push({
        id: "context", title: "Context 消息列表", icon: "context",
        badge: `${contextMsgs.length}`, badgeType: "info",
        subtitle: "LLM 调用前 Pi 组装的消息数组——system 提示词 + 历史对话 + 工具调用结果。此阶段可修改消息再交给 Provider 转换。",
        meta,
        detail: {
          type: "context",
          messages: contextMsgs.map(m => {
            const c = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
            return { role: m.role || "unknown", chars: c.length, preview: c.slice(0, 100) };
          }),
        },
      });
    }

    // Step 3: API 请求体
    if (providerPayload) {
      const payloadStr = typeof providerPayload === "string"
        ? providerPayload
        : JSON.stringify(providerPayload, null, 2);
      let model = "unknown", temp = "?";
      try {
        const p = typeof providerPayload === "string" ? JSON.parse(providerPayload) : providerPayload as any;
        model = p?.model || "unknown";
        temp = p?.temperature ?? "?";
      } catch {}
      steps.push({
        id: "api_request", title: "API 请求体", icon: "api",
        badge: providerStatus ? `${providerStatus}` : "→", badgeType: providerStatus === 200 ? "ok" : "info",
        subtitle: "before_provider_request 事件捕获——这是最终发给 DeepSeek 的完整 HTTP 请求体，包含组装后的 system prompt、消息历史、工具定义、模型参数。",
        meta: [
          { k: "端点", v: "POST chat/completions" },
          { k: "Model", v: model },
          { k: "Temp", v: `${temp}` },
          { k: "Body", v: `~${(payloadStr.length / 1024).toFixed(1)}KB` },
        ],
        detail: { type: "api_request", body: trunc(payloadStr, 8192) },
      });
    }

    // Step 4: API 响应
    if (providerStatus) {
      steps.push({
        id: "api_response", title: "API 响应", icon: "api",
        badge: `${providerStatus}`, badgeType: providerStatus === 200 ? "ok" : "warn",
        subtitle: "after_provider_response 事件捕获——DeepSeek 返回 HTTP 响应，SSE 流开始推送 token。",
        meta: [
          { k: "状态", v: `${providerStatus}`, className: providerStatus === 200 ? "ok" : "warn" },
        ],
        detail: { type: "api_response", status: providerStatus },
      });
    }

    // Step 5: 工具调用
    if (toolCalls.length) {
      const meta = toolCalls.map(t => ({
        k: t.name,
        v: `${t.isError ? "✗" : "✓"} ${t.duration ? `${t.duration}s` : ""}`,
        className: t.isError ? "warn" : "ok",
      }));
      steps.push({
        id: "tool_calls", title: "工具调用", icon: "tool",
        badge: toolCalls.every(t => !t.isError) ? "✓" : "✗",
        badgeType: toolCalls.every(t => !t.isError) ? "ok" : "warn",
        subtitle: toolCalls.map(t => `${t.name}(${typeof t.args === "string" ? t.args.slice(0, 60) : JSON.stringify(t.args).slice(0, 60)})`).join(", "),
        meta,
        detail: { type: "tool_calls", calls: toolCalls.map(t => ({
          name: t.name,
          args: typeof t.args === "string" ? t.args : JSON.stringify(t.args),
          result: t.result ? trunc(String(t.result), 1200) : "",
          isError: t.isError,
          duration: t.duration,
        }))},
      });
    }

    // Step 6: 计数器检查
    if (lastAssistantContent) {
      const { results, correction } = runCounters(lastAssistantContent, roundCount);
      const triggered = results.filter(r => !r.passed).length;
      const meta = results.map(r => ({
        k: r.name,
        v: r.detail,
        className: r.passed ? "ok" : "warn",
      }));
      steps.push({
        id: "counters", title: "计数器检查", icon: "counter",
        badge: triggered > 0 ? `${triggered} 触发` : "✓",
        badgeType: triggered > 0 ? "warn" : "ok",
        subtitle: results.map(r => `${r.passed ? "✓" : "⚠"} ${r.name}: ${r.detail}`).join(" · "),
        meta,
        detail: { type: "counters", checks: results, correction },
      });
    }

    // Step 7: 记忆提取占位（实际由 pa-mio 处理）
    steps.push({
      id: "memory", title: "记忆提取", icon: "result",
      badge: "pa-mio", badgeType: "info",
      subtitle: "agent_end 事件触发——对话 >10 条时，pa-mio 会调独立 DeepSeek 调用提取事实。",
      meta: [
        { k: "处理", v: "pa-mio" },
        { k: "存储", v: "mio_memories.json" },
      ],
      detail: { type: "memory", note: "由 pa-mio 扩展处理，pa-observe 仅报告" },
    });

    const trace = { turnIndex, steps, timestamp: Date.now() };
    const paDir = path.join(os.homedir(), ".personal-agent");
    if (!fs.existsSync(paDir)) fs.mkdirSync(paDir, { recursive: true });
    const traceFile = path.join(paDir, "observe_last_trace.json");
    try {
      fs.writeFileSync(traceFile, JSON.stringify(trace, null, 2), "utf-8");
      console.log(`[pa-observe] trace written to ${traceFile}, ${steps.length} steps, turn #${turnIndex}`);
    } catch (e) {
      console.error("[pa-observe] write failed:", e);
    }
  }

  // ── 事件钩子 ──────────────────────────────────────

  api.on("before_agent_start", (event) => {
    turnIndex++;
    reset();
    promptSystem = event.systemPrompt || "";
    console.log("[pa-observe] before_agent_start, prompt:", promptSystem.length, "chars");
  });

  api.on("context", (event) => {
    contextMsgs = event.messages || [];
    console.log("[pa-observe] context:", contextMsgs.length, "messages");
  });

  api.on("before_provider_request", (event) => {
    providerPayload = event.payload;
    console.log("[pa-observe] before_provider_request");
  });

  api.on("after_provider_response", (event) => {
    providerStatus = event.status;
    console.log("[pa-observe] after_provider_response:", event.status);
  });

  api.on("tool_execution_start", (event) => {
    toolStartTimes[event.toolCallId] = Date.now();
    console.log("[pa-observe] tool start:", event.toolName);
  });

  api.on("tool_execution_end", (event) => {
    const start = toolStartTimes[event.toolCallId] || Date.now();
    const duration = ((Date.now() - start) / 1000).toFixed(2);
    const resultText = event.result?.content?.[0]?.text
      || (typeof event.result === "string" ? event.result : JSON.stringify(event.result));

    toolCalls.push({
      name: event.toolName,
      args: event.args || {},
      result: resultText || "",
      isError: event.isError || false,
      duration: parseFloat(duration),
    });
    console.log("[pa-observe] tool end:", event.toolName, duration + "s");
  });

  api.on("message_end", (event) => {
    const msg = event.message as any;
    if (msg?.role === "assistant") {
      const content = typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("")
          : "";
      if (content && !content.includes("<function_call>")) {
        lastAssistantContent = content;
      }
    }
  });

  api.on("agent_end", () => {
    roundCount++;
    console.log("[pa-observe] agent_end, assembling trace...");
    sendTrace();
  });

  api.on("session_start", () => {
    turnIndex = 0;
    roundCount = 0;
    reset();
    console.log("[pa-observe] session reset");
  });
}

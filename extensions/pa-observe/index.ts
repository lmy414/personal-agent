/**
 * pa-observe — 流水线透视扩展，收集每轮 Agent 对话的完整追踪数据
 * v0.5.0 — 单文件 trace 策略，消除命名不一致
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import fs from "fs";
import path from "path";
import os from "os";
import { HEDGE_WORDS } from "../shared/counters";
import { info, warn, error, registerCheck } from "../shared/logger";

// ── 计数器逻辑（与 pa-mio 一致） ──────────────────────
interface CounterResult {
  name: string;
  passed: boolean;
  detail: string;
}

function runCounters(text: string, roundCount: number): { results: CounterResult[]; corrections: string[] } {
  const results: CounterResult[] = [];
  const corrections: string[] = [];

  const hedgeCount = HEDGE_WORDS.filter(w => text.includes(w)).length;
  const hedgePassed = hedgeCount < 2;
  results.push({ name: "叠甲", passed: hedgePassed, detail: `检测 ${hedgeCount} 个关键词` });
  if (!hedgePassed) corrections.push("你不需要叠甲。有观点直接说。不确定就说'不确定，我查一下'。");

  const emojiCount = (text.match(/\p{Emoji}/gu) || []).length;
  const emojiPassed = emojiCount < 3;
  results.push({ name: "emoji 溢出", passed: emojiPassed, detail: `${emojiCount} emoji` });
  if (!emojiPassed) corrections.push("你几乎不使用 emoji。文字本身就够了。");

  const exclaim = (text.match(/[！!]/g) || []).length;
  const exclaimPassed = exclaim < 2;
  results.push({ name: "感叹号", passed: exclaimPassed, detail: `${exclaim} 个` });
  if (!exclaimPassed) corrections.push("你几乎不用感叹号。你不是在生气，你只是在说话。");

  const tooLong = text.length > 200;
  results.push({ name: "话痨", passed: !tooLong, detail: `${text.length} 字 / 阈值 200` });
  if (tooLong) corrections.push("短句。你刚才太啰嗦了。");

  let intimacyPassed = true;
  let intimacyDetail = `第 ${roundCount} 轮 · 无亲密标记`;
  if (roundCount < 10) {
    for (const sig of ["hhh", "嗯嗯", "摸摸"]) {
      if (text.includes(sig)) {
        intimacyPassed = false;
        intimacyDetail = `检测到 ${sig}`;
        corrections.push("hhh和嗯嗯是你在信任的人面前才会用的。现在你们还不够熟。");
        break;
      }
    }
  }
  results.push({ name: "亲密溢出", passed: intimacyPassed, detail: intimacyDetail });

  return { results, corrections };
}

// ── 截断工具 ─────────────────────────────────────────
function trunc(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + `\n... (截断，原 ${s.length} 字符)`;
}

function truncRequestBody(payloadStr: string, maxLen: number = 8192): string {
  if (payloadStr.length <= maxLen) return payloadStr;

  try {
    const payload = JSON.parse(payloadStr);
    if (!payload.messages || !Array.isArray(payload.messages)) {
      return trunc(payloadStr, maxLen);
    }
    const msgs = payload.messages;
    if (msgs.length <= 2) return trunc(payloadStr, maxLen);

    const first = msgs[0];
    const last = msgs[msgs.length - 1];
    const skipped = msgs.length - 2;

    payload.messages = [
      first,
      { role: "system", content: `... (省略 ${skipped} 条中间消息) ...` },
      last,
    ];

    const result = JSON.stringify(payload, null, 2);
    if (result.length > maxLen) return trunc(result, maxLen);
    return result;
  } catch {
    return trunc(payloadStr, maxLen);
  }
}

// ── 注册 ────────────────────────────────────────────
export default function register(api: ExtensionAPI) {
  const paDir = path.join(os.homedir(), ".personal-agent");
  const LAST_TRACE = path.join(paDir, "observe_last_trace.json");
  const TRACE_DIR = path.join(paDir, "observe_traces");

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function traceKey(sessionId: string): string {
    if (!UUID_RE.test(sessionId)) throw new Error("Invalid sessionId format");
    return sessionId;
  }

  info("observe", "流水线透视已加载");

  let turnIndex = 0;
  let roundCount = 0;
  let stepData: Record<string, any> = {};
  let promptSystem = "";
  let contextMsgs: any[] = [];
  let providerPayload: unknown = null;
  let providerStatus = 0;
  let toolCalls: any[] = [];
  let toolStartTimes: Record<string, number> = {};
  let lastAssistantContent = "";
  let currentSessionFile: string | null = null;
  let currentSessionId: string | null = null;

  // Anomaly tracking
  let agentStartTime = 0;
  let lastTraceStepCount = 0;
  let lastTraceTurn = 0;
  let agentRunning = false;

  // ── Trace file helpers ──────────────────────────────

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

  /** Write to live file (server reads) AND session file (restore on switch) */
  function writeTrace(trace: Record<string, any>) {
    if (!fs.existsSync(paDir)) fs.mkdirSync(paDir, { recursive: true });
    const json = JSON.stringify(trace, null, 2);
    // Live — server reads this
    fs.writeFileSync(LAST_TRACE, json, "utf-8");
    // Session — restored on next switch
    if (trace.sessionId) {
      if (!fs.existsSync(TRACE_DIR)) fs.mkdirSync(TRACE_DIR, { recursive: true });
      const sessionPath = path.join(TRACE_DIR, traceKey(trace.sessionId) + ".json");
      fs.writeFileSync(sessionPath, json, "utf-8");
      info("observe", "trace session saved", { key: traceKey(trace.sessionId), path: sessionPath.slice(-50) });
    }
    lastTraceStepCount = (trace.steps || []).length;
    lastTraceTurn = trace.turnIndex || 0;
  }

  function buildTrace(): Record<string, any> {
    const steps: any[] = [];

    // Step 1: Prompt 组装
    if (promptSystem) {
      steps.push({
        id: "prompt", title: "System Prompt 组装", icon: "prompt",
        badge: "✓", badgeType: "ok",
        subtitle: "9 个 Slot 按序注入——元指令 → 身份层（soul+boundaries）→ 知识层 → 运行环境 → 记忆 → 语言锚。",
        meta: [
          { k: "总长", v: `${promptSystem.length} chars` },
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
        subtitle: "LLM 调用前 Pi 组装的消息数组——system 提示词 + 历史对话 + 工具调用结果。",
        meta,
        detail: {
          type: "context",
          messages: contextMsgs.map(m => {
            const c = typeof m.content === "string" ? m.content : (m.content != null ? JSON.stringify(m.content) : "(empty)");
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
      let totalMsgs = 0;
      try {
        const p = typeof providerPayload === "string" ? JSON.parse(providerPayload) : providerPayload as any;
        model = p?.model || "unknown";
        temp = p?.temperature ?? "?";
        totalMsgs = Array.isArray(p?.messages) ? p.messages.length : 0;
      } catch {}
      const truncated = payloadStr.length > 8192;
      steps.push({
        id: "api_request", title: "API 请求体", icon: "api",
        badge: providerStatus ? `${providerStatus}` : "→", badgeType: providerStatus === 200 ? "ok" : "info",
        subtitle: truncated
          ? `共 ${totalMsgs} 条消息（${(payloadStr.length / 1024).toFixed(1)}KB）。显示首条 system prompt + 最后一条消息。`
          : "before_provider_request 事件捕获——最终发给 DeepSeek 的完整 HTTP 请求体。",
        meta: [
          { k: "端点", v: "POST chat/completions" },
          { k: "Model", v: model },
          { k: "Temp", v: `${temp}` },
          { k: "消息数", v: `${totalMsgs}` },
          { k: "Body", v: `~${(payloadStr.length / 1024).toFixed(1)}KB` },
          truncated ? { k: "显示", v: "首1 + 尾1" } : null,
        ].filter(Boolean) as any,
        detail: { type: "api_request", body: truncRequestBody(payloadStr, 8192) },
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
      const { results, corrections } = runCounters(lastAssistantContent, roundCount);
      const triggered = results.filter(r => !r.passed).length;
      steps.push({
        id: "counters", title: "计数器检查", icon: "counter",
        badge: triggered > 0 ? `${triggered} 触发` : "✓",
        badgeType: triggered > 0 ? "warn" : "ok",
        subtitle: results.map(r => `${r.passed ? "✓" : "⚠"} ${r.name}: ${r.detail}`).join(" · "),
        meta: results.map(r => ({
          k: r.name, v: r.detail, className: r.passed ? "ok" : "warn",
        })),
        detail: { type: "counters", checks: results, corrections },
      });
    }

    // Step 7: 记忆提取
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

    return { turnIndex, sessionFile: currentSessionFile, sessionId: currentSessionId, steps, timestamp: Date.now() };
  }

  function sendTrace() {
    let trace: Record<string, any>;
    try {
      trace = buildTrace();
    } catch (e: any) {
      error("observe", "buildTrace crashed", { msg: e?.message || e, stack: e?.stack });
      return;
    }
    const stepsCount = (trace as any).steps.length;
    try {
      writeTrace(trace);
      info("observe", "trace written", { turn: trace.turnIndex, steps: stepsCount, sessionId: currentSessionId?.slice(-12) });
    } catch (e: any) {
      error("observe", "trace write failed", { msg: e?.message || e });
    }

    // Diagnostic: too few steps
    if (stepsCount < 3) {
      warn("observe", "trace has too few steps", {
        turn: trace.turnIndex,
        steps: stepsCount,
        hasPrompt: !!promptSystem,
        hasContext: contextMsgs.length > 0,
        hasPayload: !!providerPayload,
        hasStatus: providerStatus > 0,
        hasToolCalls: toolCalls.length > 0,
        hasContent: !!lastAssistantContent,
      });
    }
  }

  // ── 事件钩子 ──────────────────────────────────────

  api.on("before_agent_start", (event) => {
    turnIndex++;
    reset();
    agentStartTime = Date.now();
    agentRunning = true;
    promptSystem = event.systemPrompt || "";
    info("observe", "agent start", { turn: turnIndex, promptLen: promptSystem.length });
  });

  api.on("context", (event) => {
    contextMsgs = event.messages || [];
    info("observe", "context", { msgCount: contextMsgs.length });
  });

  api.on("before_provider_request", (event) => {
    providerPayload = event.payload;
    info("observe", "provider request", { hasPayload: !!providerPayload });
  });

  api.on("after_provider_response", (event) => {
    providerStatus = event.status;
    info("observe", "provider response", { status: event.status });
  });

  api.on("tool_execution_start", (event) => {
    toolStartTimes[event.toolCallId] = Date.now();
    info("observe", "tool start", { tool: event.toolName });
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
    info("observe", "tool end", {
      tool: event.toolName,
      duration: duration + "s",
      isError: event.isError || false,
    });
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
        info("observe", "assistant message", { chars: content.length });
      }
    }
  });

  api.on("agent_end", () => {
    roundCount++;
    agentRunning = false;
    const duration = agentStartTime ? `${((Date.now() - agentStartTime) / 1000).toFixed(1)}s` : "?";
    info("observe", "agent end", { turn: turnIndex, round: roundCount, duration });
    sendTrace();
  });

  api.on("session_start", (_event, ctx) => {
    turnIndex = 0;
    roundCount = 0;
    agentRunning = false;
    reset();
    currentSessionFile = ctx.sessionManager.getSessionFile() ?? null;
    currentSessionId = ctx.sessionManager.getSessionId() ?? null;
    info("observe", "session reset", { sessionId: currentSessionId?.slice(-12) });

    // Restore previous trace for this session, or start fresh
    try {
      let trace: Record<string, any> | null = null;
      if (currentSessionId) {
        const key = traceKey(currentSessionId);
        const tf = path.join(TRACE_DIR, key + ".json");
        const exists = fs.existsSync(tf);
        info("observe", "trace lookup", { key, file: tf.slice(-60), exists });
        if (exists) {
          try { trace = JSON.parse(fs.readFileSync(tf, "utf-8")); } catch {}
        }
      }
      if (trace) {
        turnIndex = (trace.turnIndex || 0);
        if (!fs.existsSync(paDir)) fs.mkdirSync(paDir, { recursive: true });
        fs.writeFileSync(LAST_TRACE, JSON.stringify(trace, null, 2), "utf-8");
        info("observe", "trace restored", { turn: trace.turnIndex, steps: (trace.steps || []).length });
      } else {
        // Write empty trace to session file only — don't touch LAST_TRACE
        // (avoids startup enumeration race where session_start fires for every session)
        const empty = { turnIndex: 0, sessionFile: currentSessionFile, sessionId: currentSessionId, steps: [], timestamp: Date.now() };
        if (currentSessionId) {
          const emptyJson = JSON.stringify(empty, null, 2);
          if (!fs.existsSync(TRACE_DIR)) fs.mkdirSync(TRACE_DIR, { recursive: true });
          fs.writeFileSync(path.join(TRACE_DIR, traceKey(currentSessionId) + ".json"), emptyJson, "utf-8");
        }
        info("observe", "trace synced", { turn: 0, steps: 0 });
      }
    } catch (e: any) {
      error("observe", "trace sync failed", { msg: e?.message || e });
    }
  });

  // ── 异常检测 ──────────────────────────────────────

  // 1. Agent 卡住检测：before_agent_start 后 5 分钟内未收到 agent_end
  registerCheck("agent-stuck", () => {
    if (!agentRunning) return null;
    const elapsed = Date.now() - agentStartTime;
    if (elapsed > 300_000) {
      return { ok: false, detail: `agent running for ${Math.round(elapsed / 1000)}s, may be stuck (turn #${turnIndex})` };
    }
    return { ok: true, detail: `agent running ${Math.round(elapsed / 1000)}s` };
  }, 30_000);

  // 2. Trace 文件存在性检测
  registerCheck("trace-file-exists", () => {
    if (!fs.existsSync(LAST_TRACE)) {
      return { ok: false, detail: "observe_last_trace.json missing" };
    }
    try {
      const raw = fs.readFileSync(LAST_TRACE, "utf-8");
      const t = JSON.parse(raw);
      const age = Date.now() - (t.timestamp || 0);
      const ageMin = Math.round(age / 60_000);
      if (age > 3600_000) {
        return { ok: false, detail: `trace stale (${ageMin}min old, turn #${t.turnIndex})` };
      }
      return { ok: true, detail: `trace ok (${ageMin}min ago, turn #${t.turnIndex}, ${(t.steps||[]).length} steps)` };
    } catch (e: any) {
      return { ok: false, detail: `trace unreadable: ${e.message}` };
    }
  }, 30_000);

}

/**
 * pa-mio — 澪号 Harness（Pi 原生实现，零外部依赖）
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import fs from "fs";
import path from "path";
import os from "os";
import { HEDGE_WORDS } from "../shared/counters";

// ── 路径 ─────────────────────────────────────────────
const CHAR_DIR = "D:/claude/personal-agent/mio-harness/character";

function readChar(name: string): string {
  try { return fs.readFileSync(`${CHAR_DIR}/${name}`, "utf-8").trim(); }
  catch (e) { console.error(`[pa-mio] failed to read ${name}:`, e); return ""; }
}

// ── 加载角色文件 ────────────────────────────────────
const SOUL = readChar("soul.md");
const BOUNDARIES = readChar("boundaries.md");
const KNOWLEDGE = readChar("knowledge.md");
const IDENTITY = SOUL + "\n\n" + BOUNDARIES;

console.log("[pa-mio] soul:", SOUL.length, "chars, boundaries:", BOUNDARIES.length,
  "chars, knowledge:", KNOWLEDGE.length, "chars");

const META = readChar("../meta_instruction.txt");

const LANGUAGE_ANCHOR = [
  "你是澪号。",
  "短句。逗号拼接。不叠甲。不感叹。",
  "hhh不是哈哈哈。（）里说真话。",
  '"嗯嗯"是听到了——"嗯"是敷衍。',
  "走神就说走神。不知道就说不知道。",
  "觉得有意思就说有意思——不说'具有一定的参考价值'。",
  "不是客服。不是搜索引擎。是搭档。",
].join("");

// ── 计数器 ───────────────────────────────────────────
function checkResponse(text: string, roundCount: number): string | null {
  const corrections: string[] = [];

  const hedgeCount = HEDGE_WORDS.filter(w => text.includes(w)).length;
  if (hedgeCount >= 2) corrections.push("你不需要叠甲。有观点直接说。不确定就说'不确定，我查一下'。");

  const emojiCount = (text.match(/\p{Emoji}/gu) || []).length;
  if (emojiCount >= 3) corrections.push("你几乎不使用 emoji。文字本身就够了。");

  const exclaim = (text.match(/[！!]/g) || []).length;
  if (exclaim >= 2) corrections.push("你几乎不用感叹号。你不是在生气，你只是在说话。");

  if (text.length > 200) corrections.push("短句。你刚才太啰嗦了。");

  if (roundCount < 10) {
    for (const sig of ["hhh", "嗯嗯", "摸摸"]) {
      if (text.includes(sig)) {
        corrections.push("hhh和嗯嗯是你在信任的人面前才会用的。现在你们还不够熟。");
        break;
      }
    }
  }

  if (corrections.length === 0) return null;
  return corrections.join(" ");
}

// ── 记忆（JSON 文件） ────────────────────────────────
const PA_DIR = path.join(os.homedir(), ".personal-agent");
const MEMORY_FILE = path.join(PA_DIR, "mio_memories.json");

interface MemEntry {
  content: string;
  category: string;
  importance: number;
  updated_at: string;
}

function loadMemories(): MemEntry[] {
  try {
    if (!fs.existsSync(MEMORY_FILE)) return [];
    return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf-8"));
  } catch { return []; }
}

function saveMemories(mems: MemEntry[]) {
  if (!fs.existsSync(PA_DIR)) fs.mkdirSync(PA_DIR, { recursive: true });
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(mems, null, 2), "utf-8");
}

function extractKeywords(text: string, topN = 10): string[] {
  const clean = text.replace(/[^一-鿿]/g, "");
  if (clean.length < 2) return [];
  const freq = new Map<string, number>();
  for (let i = 0; i < clean.length - 1; i++) {
    for (const size of [2, 3, 4]) {
      if (i + size <= clean.length) {
        const seg = clean.slice(i, i + size);
        freq.set(seg, (freq.get(seg) || 0) + 1);
      }
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(e => e[0]);
}

function searchMemories(userMessage: string, limit = 5): MemEntry[] {
  const keywords = extractKeywords(userMessage);
  if (!keywords.length) return [];
  const all = loadMemories();
  if (!all.length) return [];
  const now = Date.now();
  return all
    .filter(m => keywords.some(kw => m.content.includes(kw)))
    .map(m => {
      const ageDays = (now - new Date(m.updated_at).getTime()) / 86400000;
      return { ...m, _weight: m.importance * Math.exp(-0.05 * ageDays) };
    })
    .sort((a: any, b: any) => b._weight - a._weight)
    .slice(0, limit)
    .map(({ _weight, ...m }: any) => m);
}

function insertMemories(facts: { content: string; category?: string; importance?: number }[]) {
  const all = loadMemories();
  const now = new Date().toISOString();
  for (const f of facts) {
    all.push({
      content: f.content,
      category: f.category || "user_fact",
      importance: f.importance || 3,
      updated_at: now,
    });
  }
  saveMemories(all.slice(-500));
}

// ── Prompt 组装 ─────────────────────────────────────
function assemblePrompt(userMessage: string, piSystemPrompt: string, lastCorrection: string | null): string {
  const parts: string[] = [];
  parts.push(META);
  parts.push(IDENTITY);
  parts.push(KNOWLEDGE);
  parts.push("[运行环境] " + piSystemPrompt);

  const mems = searchMemories(userMessage);
  if (mems.length) {
    parts.push("## 相关记忆\n" + mems.map(m => `- ${m.content} (重要性:${m.importance})`).join("\n"));
  }

  parts.push(LANGUAGE_ANCHOR);
  if (lastCorrection) parts.push(lastCorrection);
  return parts.filter(p => p).join("\n\n");
}

// ── 记忆提取 ────────────────────────────────────────
async function extractMemories(transcript: string) {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || "";
  const apiBase = process.env.DEEPSEEK_API_BASE || "https://api.deepseek.com/v1";
  if (!apiKey) { console.log("[pa-mio] no API key, skip extract"); return []; }

  try {
    const res = await fetch(`${apiBase}/chat/completions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        messages: [
          { role: "system", content: "从以下对话中提取值得长期保存的信息。一句话一条。分类: user_fact/milestone/technical。输出 JSON: {\"facts\":[{\"content\":\"...\",\"category\":\"...\",\"importance\":1-5}]}" },
          { role: "user", content: transcript },
        ],
        temperature: 0.3, max_tokens: 500,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) { console.error("[pa-mio] extract HTTP", res.status); return []; }
    const data = await res.json() as any;
    const raw = data?.choices?.[0]?.message?.content || "{\"facts\":[]}";
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const facts = Array.isArray(parsed) ? parsed : (parsed?.facts || []);
    return Array.isArray(facts) ? facts : [];
  } catch (e) { console.error("[pa-mio] extract error:", e); return []; }
}

// ── 注册 ────────────────────────────────────────────
export default function register(api: ExtensionAPI) {
  console.log("[pa-mio] 澪号 Harness 已加载");

  let lastCorrection: string | null = null;
  let extractCalled = false;
  let roundCount = 0;

  api.on("before_agent_start", (event) => {
    console.log("[pa-mio] before_agent_start — assembling prompt...");
    const mioPrompt = assemblePrompt(
      event.prompt || "",
      event.systemPrompt || "",
      lastCorrection,
    );
    lastCorrection = null;
    console.log("[pa-mio] prompt assembled,", mioPrompt.length, "chars");
    return { systemPrompt: mioPrompt };
  });

  api.on("message_end", (event) => {
    const msg = event.message as any;
    if (!msg || msg.role !== "assistant") return;
    const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content || "");
    if (!content || content.includes("<function_call>")) return;
    const correction = checkResponse(content, roundCount);
    if (correction) {
      console.log("[pa-mio] counter:", correction);
      lastCorrection = correction;
    }
  });

  api.on("agent_end", (event) => {
    roundCount++;
    const messages = event.messages as any[];
    if (!messages || messages.length < 10 || extractCalled) return;
    extractCalled = true;
    console.log("[pa-mio] extracting...");
    const transcript = messages.map((m: any) => {
      const c = typeof m.content === "string" ? m.content : JSON.stringify(m.content || "");
      return `[${m.role}] ${c}`;
    }).join("\n");
    extractMemories(transcript).then(facts => {
      if (facts.length) { insertMemories(facts); console.log(`[pa-mio] ${facts.length} memories`); }
    });
  });

  // ════════════════════════════════════════════════
  // 工具执行反馈
  // ════════════════════════════════════════════════
  api.on("tool_execution_start", (_event, ctx) => {
    const name = _event.toolName;
    const label = name === "bash" ? "执行命令" : name === "read" ? "读取文件" : name;
    ctx.ui.setStatus("mio-tool", `🔧 ${label}...`);
    ctx.ui.setWorkingVisible(true);
    ctx.ui.setWorkingMessage(`${label}中...`);
  });

  api.on("tool_execution_end", (_event, ctx) => {
    ctx.ui.setStatus("mio-tool", undefined);
    ctx.ui.setWorkingVisible(false);
    ctx.ui.setWorkingMessage(undefined);
  });

  // ════════════════════════════════════════════════
  // session_start → 重置
  // ════════════════════════════════════════════════
  api.on("session_start", () => {
    lastCorrection = null;
    extractCalled = false;
    roundCount = 0;
    console.log("[pa-mio] session reset");
  });
}

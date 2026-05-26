"""澪号 Harness — 前馈引导 + 反馈校验 + 修正闭环"""

import os, json, re, subprocess
from counters import check_all
from memory import search_memories, insert_memories, ensure_table, count_memories
from extractor import extract_memories

BASE = os.path.dirname(os.path.abspath(__file__))
CHARS = os.path.join(BASE, "character")


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read().strip()


class MioHarness:
    def __init__(self):
        ensure_table()
        self.static = {
            "meta": read(os.path.join(BASE, "meta_instruction.txt")),
            "identity": (
                read(os.path.join(CHARS, "soul.md"))
                + "\n\n"
                + read(os.path.join(CHARS, "boundaries.md"))
            ),
            "knowledge": read(os.path.join(CHARS, "knowledge.md")),
            "tools": read(os.path.join(BASE, "tools_stub.txt")),
            "language_anchor": (
                "你是澪号。"
                "短句。逗号拼接。不叠甲。不感叹。"
                "hhh不是哈哈哈。（）里说真话。"
                '"嗯嗯"是听到了——"嗯"是敷衍。'
            ),
        }
        self.max_retries = 3
        self._last_correction = None

    # ================================================================
    # 外部接口
    # ================================================================

    def build_prompt(
        self,
        user_message: str,
        chat_history: list | None = None,
        tools_definition: str = "",
        pi_system_prompt: str = "",
    ) -> str:
        """
        组装完整的澪号对话 Prompt。
        Pi 在每次调用前调用此方法。

        chat_history: [{"role":"user"|"assistant"|"tool", "content":"..."}, ...]
        tools_definition: Pi 注入的实际工具列表描述
        pi_system_prompt: Pi 的原生系统提示词（退化为工具层背景说明）
        """
        chat_history = chat_history or []
        parts = []

        # Slot 0: 元指令（固定）
        parts.append(self.static["meta"])

        # Slot 1: 身份层（固定）
        parts.append(self.static["identity"])

        # Slot 2: 知识层（固定）
        parts.append(self.static["knowledge"])

        # Slot 3: 工具层
        # Pi 原生提示词退化为背景说明，工具定义是主体
        slot3_parts = []
        if pi_system_prompt:
            slot3_parts.append("[运行环境] " + pi_system_prompt)
        tool_text = tools_definition or self.static["tools"]
        slot3_parts.append(tool_text)
        parts.append("\n\n".join(slot3_parts))

        # Slot 4: 记忆层（动态检索）
        memories = search_memories(user_message)
        if memories:
            mem_text = "## 相关记忆\n" + "\n".join(
                f"- {m['content']} (重要性:{m['importance']})"
                for m in memories
            )
            parts.append(mem_text)

        # Slot 5: 对话历史
        # 如果最后一条是长工具返回，先插语言锚
        if self._last_tool_long(chat_history):
            parts.append(self.static["language_anchor"])
        parts.append(self._fmt_history(chat_history))

        # Slot 6: 语言锚（固定，最靠近输出）
        parts.append(self.static["language_anchor"])

        # Slot 7: 修正槽（条件注入）
        if self._last_correction:
            parts.append(self._last_correction)

        # Slot 8: 用户消息
        parts.append(user_message)

        return "\n\n".join(p for p in parts if p)

    def build_prompt_for_extraction(self, transcript: str) -> str:
        """构建记忆提取专用 System Prompt（独立于角色人格）"""
        return (
            "从以下对话中提取值得长期保存的信息。一句话一条。\n"
            "分类: user_fact / milestone / technical。\n"
            "不要提取闲聊内容。如果没有值得保存的，返回空数组。\n"
            "输出纯 JSON 数组。\n"
        )

    def check_response(
        self, response_text: str, chat_history: list | None = None
    ) -> str | None:
        """
        检查澪号的回复是否触发计数器。
        返回修正指令字符串，或 None（全绿）。
        """
        return check_all(response_text, chat_history or [])

    def post_conversation(self, transcript: str, call_api):
        """
        对话结束后的记忆提取。
        call_api(system_prompt, user_content) -> str 是你的 LLM 调用函数。
        """
        system = self.build_prompt_for_extraction(transcript)
        try:
            result = call_api(system, transcript)
            facts = json.loads(result)
            if isinstance(facts, list) and facts:
                insert_memories(facts)
        except Exception:
            pass  # 提取失败不抛异常，不影响主流程

    def reset_correction(self):
        """每次新对话开始时清空修正槽"""
        self._last_correction = None

    # ================================================================
    # 内部方法
    # ================================================================

    def _last_tool_long(self, history: list) -> bool:
        if not history:
            return False
        last = history[-1]
        if last.get("role") != "tool":
            return False
        return len(str(last.get("content", ""))) > 500

    def _fmt_history(self, history: list) -> str:
        if not history:
            return ""
        lines = []
        for m in history:
            role = m.get("role", "user").upper()
            content = str(m.get("content", ""))
            lines.append(f"[{role}] {content}")
        return "\n".join(lines)

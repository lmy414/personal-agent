"""对话后记忆提取 — 独立 LLM 调用"""

import json


EXTRACTION_SYSTEM = """从以下对话中提取值得长期保存的信息。

规则：
- 一句话一条，不超过 100 字
- 只提取有长期价值的信息。不提取闲聊内容
- 分类：user_fact（用户事实）/ milestone（会话里程碑）/ technical（技术笔记）
- 重要性 1-5：5 是核心身份信息，1 是可能有用但不确定
- 如果没有值得保存的内容，返回空数组 []
- 输出纯 JSON 数组

示例输出：
[
  {"content": "Mirror 在调试 Blender ILM 贴图的通道读取问题", "category": "technical", "importance": 3},
  {"content": "澪号和 Mirror 讨论了群聊 vs 私聊的语言差异", "category": "milestone", "importance": 2}
]"""


def extract_memories(transcript: str, call_api) -> list:
    """
    调用 LLM 从对话全文中提取记忆。

    Args:
        transcript: 完整对话文本
        call_api: function(system_prompt, user_content) -> str

    Returns:
        提取到的记忆列表 [{"content":"...", "category":"...", "importance":3}, ...]
    """
    try:
        result = call_api(EXTRACTION_SYSTEM, transcript)
        facts = json.loads(result)
        if isinstance(facts, list):
            # 验证每条记忆的字段
            valid = []
            for f in facts:
                if isinstance(f, dict) and "content" in f:
                    valid.append({
                        "content": str(f["content"])[:200],
                        "category": f.get("category", "user_fact"),
                        "importance": min(5, max(1, int(f.get("importance", 3)))),
                    })
            return valid
    except (json.JSONDecodeError, Exception):
        pass
    return []

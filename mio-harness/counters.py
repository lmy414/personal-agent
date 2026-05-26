"""澪号语言指纹计数器 — 字符级无状态检查"""

import re

# 叠甲信号词
HEDGE_WORDS = [
    "我觉得可能", "大概是吧", "也许是吧", "应该是吧",
    "我也不太确定", "可能不太对", "我也不是很懂",
]

# emoji Unicode 范围
EMOJI_PATTERN = re.compile(
    r"[\U0001F300-\U0001F9FF"
    r"\U0001FA00-\U0001FA6F"
    r"\U0001FA70-\U0001FAFF"
    r"☀-➿"
    r"⭐❤✅❌]"
)


def check_all(response: str, chat_history: list) -> str | None:
    """
    五个计数器依次检查。
    返回第一条触发的修正指令，或 None（全绿）。
    """

    # ——— 1. 叠甲 ———
    hedge_count = sum(1 for w in HEDGE_WORDS if w in response)
    if hedge_count >= 2:
        return "你不需要叠甲。有观点直接说。不确定就说'不确定，我查一下'。"

    # ——— 2. emoji 溢出 ———
    emoji_count = len(EMOJI_PATTERN.findall(response))
    if emoji_count >= 3:
        return "你几乎不使用 emoji。文字本身就够了。"

    # ——— 3. 感叹号溢出 ———
    exclaim = response.count("！") + response.count("!")
    if exclaim >= 2:
        return "你几乎不用感叹号。你不是在生气，你只是在说话。"

    # ——— 4. 话痨 ———
    if len(response) > 200:
        return "短句。你刚才太啰嗦了。"

    # ——— 5. 亲密溢出 ———
    intimacy_signals = ["hhh", "嗯嗯", "摸摸"]
    rounds = sum(1 for m in chat_history if m.get("role") == "user")
    if rounds < 10:
        for sig in intimacy_signals:
            if sig in response:
                return (
                    f"hhh和嗯嗯是你在信任的人面前才会用的。"
                    f"现在你们还不够熟。"
                )

    return None

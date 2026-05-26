"""pa-mio 扩展 ↔ Python Harness 桥接层"""
import sys, json, io, os

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))

from harness import MioHarness

_harness = MioHarness()


def cmd_assemble(user_message: str):
    """输出澪号的 Prompt 前缀"""
    # pi_system_prompt 通过环境变量或第二个 stdin 行传入
    pi_sp = os.environ.get("PI_SYSTEM_PROMPT", "")
    prefix = _harness.build_prompt(user_message, pi_system_prompt=pi_sp)
    print(prefix)


def cmd_check(args: list, response: str):
    """检查澪号回复，如果触发计数器则输出修正指令"""
    rounds = int(args[0]) if args else 0
    chat_history = [{"role": "user"}] * rounds  # 简化估算
    correction = _harness.check_response(response, chat_history)
    if correction:
        print(correction)


def cmd_extract(transcript: str):
    """对话后记忆提取并写入 SQLite"""
    from extractor import extract_memories
    from memory import insert_memories

    # 用 extractor 的系统提示词 + DeepSeek 独立调用
    import requests, os

    api_key = os.environ.get(
        "DEEPSEEK_API_KEY",
        os.environ.get("OPENAI_API_KEY", ""),
    )
    api_base = os.environ.get(
        "DEEPSEEK_API_BASE",
        "https://api.deepseek.com/v1",
    )

    if not api_key:
        print("[pa-mio] 未设置 DEEPSEEK_API_KEY，跳过记忆提取")
        return

    def call_api(system: str, user: str) -> str:
        r = requests.post(
            f"{api_base}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": os.environ.get("DEEPSEEK_MODEL", "deepseek-chat"),
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "temperature": 0.3,
                "max_tokens": 500,
                "response_format": {"type": "json_object"},
            },
            timeout=30,
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]

    facts = extract_memories(transcript, call_api)
    if facts:
        insert_memories(facts)
        print(f"[pa-mio] 已提取 {len(facts)} 条记忆")
    else:
        print("[pa-mio] 无可提取的记忆")


def cmd_reset():
    """清空修正槽"""
    _harness.reset_correction()
    print("[pa-mio] 修正槽已清空")


def cmd_init():
    """初始化数据库表"""
    from memory import ensure_table
    ensure_table()
    print("[pa-mio] 数据库表已就绪")


def cmd_test(user_message: str = "你好"):
    """自检：打印完整 Prompt 结构"""
    pi_sp = os.environ.get("PI_SYSTEM_PROMPT", "[Pi原生提示词-模拟]")
    prompt = _harness.build_prompt(user_message, pi_system_prompt=pi_sp)
    print("=" * 60)
    print("澪号 Harness 自检 — 完整 Prompt 结构")
    print("=" * 60)
    print(prompt)
    print("=" * 60)
    print(f"总字符数: {len(prompt)}")
    print(f"估算 tokens: {len(prompt) * 0.6:.0f}")


# ================================================================
# 入口
# ================================================================

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "test"

    if cmd == "assemble":
        stdin = sys.stdin.read().strip()
        cmd_assemble(stdin)
    elif cmd == "check":
        args = sys.argv[2:]
        stdin = sys.stdin.read().strip()
        cmd_check(args, stdin)
    elif cmd == "extract":
        stdin = sys.stdin.read().strip()
        cmd_extract(stdin)
    elif cmd == "reset":
        cmd_reset()
    elif cmd == "init":
        cmd_init()
    elif cmd == "test":
        test_text = sys.argv[2] if len(sys.argv) > 2 else "你好"
        cmd_test(test_text)
    else:
        print(f"未知命令: {cmd}")
        print("用法: bridge.py <assemble|check|extract|reset|init|test>")
        sys.exit(1)

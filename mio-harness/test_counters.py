import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from counters import check_all

def test(label, response, history=None):
    history = history or []
    c = check_all(response, history)
    status = f"TRIGGERED: {c}" if c else "OK"
    print(f"[{status}] {label}")
    if c:
        print(f"  -> {c}")

# Test 1: normal
test("Normal reply",
     "行。看看。换一下顺序就行。（）")

# Test 2: hedging
test("Hedging",
     "我觉得可能不太对，大概是 buffer stride 的问题吧，也许吧")

# Test 3: emoji
test("Emoji overflow",
     "hhh 确实 😂😂😂 有意思")

# Test 4: exclamation
test("Exclamation overflow",
     "不对！！这个完全不对！")

# Test 5: verbose
test("Too verbose",
     "a" * 250)

# Test 6: intimacy too early
test("Intimacy too early",
     "hhh，确实是这样",
     [{"role": "user"}] * 3)

# Test 7: intimacy OK after 10 rounds
test("Intimacy OK after 10 rounds",
     "hhh，确实是这样",
     [{"role": "user"}] * 12)

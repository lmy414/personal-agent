#!/usr/bin/env python3
"""
QQ Group Chat Analysis for Mirror (澪号 project)
Extracts Mirror's messages from all 5 QQ groups and produces comprehensive analysis.
"""
import json
import os
import re
import sys
import io
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import jieba

# Config
BASE = os.path.expandvars(r"C:\Users\Mirror\.qq-chat-exporter\exports")
MIRROR_UID = "u_3t11EHHiVL87DkBFRYomxQ"
OUT_DIR = os.path.expandvars(r"D:\claude\personal-agent\mio-data")

# Map group identifiers to directory matching patterns
GROUP_CONFIG = [
    {
        "key": "1034791447",
        "name": "人类工程灾后重建计划",
        "dir_match": "1034791447",  # unique number in dir name
        "mirror_aliases": ["夏目安安", "希儿"],
        "expected": 8727,
    },
    {
        "key": "shrimp",
        "name": "🦐🍐退休闲散人员交流部",
        "dir_match": "退休闲散",  # unique Chinese in dir name
        "mirror_aliases": ["夏目安安", "希儿"],
        "expected": 3577,
    },
    {
        "key": "921932191",
        "name": "游戏公会",
        "dir_match": "921932191",
        "mirror_aliases": ["希儿世界第一可爱", "希儿"],
        "expected": 2064,
    },
    {
        "key": "873351992",
        "name": "二次元交流",
        "dir_match": "873351992",
        "mirror_aliases": ["希儿"],
        "expected": 608,
    },
    {
        "key": "879317594",
        "name": "210(WebGIS)",
        "dir_match": "879317594",
        "mirror_aliases": ["希儿"],
        "expected": 20,
    },
]

CJK_RE = re.compile(r'[一-鿿㐀-䶿]')
PUNCT_CHARS = '，。！？、；：""''（）《》【】…—\-,.!?;:()[]{}<>«»…\s'
PUNCT_RE = re.compile(r'[' + re.escape(PUNCT_CHARS) + r']')
EMOJI_RE = re.compile(r'[\U0001F300-\U0001F9FF☀-➿⌀-⏿]')

STOP_WORDS = set("的了是在我有不这人也他她它和那你要到就们对没为以可以自己把被让从与但而或因为所以如果虽然然而然后等之其及即于很都也还更最所又去来能会过一二两三四五六七八九十百千万亿些个条次种点只些多大小中上下前后左右好坏高长新旧快慢多少全每个这那哪谁什么怎么怎样哪里那儿这儿各该其我的你的他的她的".replace(" ", ""))


def find_group_dir(match_str):
    """Find group directory by matching string in directory name."""
    for d in os.listdir(BASE):
        full = os.path.join(BASE, d)
        if os.path.isdir(full) and match_str in d:
            return full
    return None


def extract_mirror_messages(group_dir):
    """Stream through all chunks and extract Mirror's messages."""
    chunks_dir = os.path.join(group_dir, "chunks")
    manifest_path = os.path.join(group_dir, "manifest.json")

    if not os.path.exists(manifest_path):
        return [], {}

    manifest = json.load(open(manifest_path, encoding="utf-8"))
    group_name = manifest["chatInfo"]["name"]
    mirror_name = None
    for s in manifest["statistics"]["senders"]:
        if s.get("uid") == MIRROR_UID:
            mirror_name = s.get("name", "Unknown")
            break

    messages = []
    chunk_files = sorted(os.listdir(chunks_dir))
    total_files = len(chunk_files)
    for fi, cf in enumerate(chunk_files):
        if not cf.endswith(".jsonl"):
            continue
        filepath = os.path.join(chunks_dir, cf)
        with open(filepath, encoding="utf-8") as f:
            for line in f:
                try:
                    msg = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if msg.get("sender", {}).get("uid") != MIRROR_UID:
                    continue
                content = msg.get("content", {})
                text = content.get("text", "").strip()
                if not text:
                    continue
                msg_type = msg.get("type", "text")
                ts = msg.get("timestamp", 0)
                messages.append({
                    "text": text,
                    "type": msg_type,
                    "ts": ts,
                    "time": msg.get("time", ""),
                    "length": len(text),
                })

    return messages, {"name": group_name, "mirror_name": mirror_name, "manifest": manifest}


def analyze_messages(messages, group_info):
    """Run all analysis dimensions on extracted messages."""
    if not messages:
        return {"error": "No messages found"}

    total = len(messages)
    lengths = [m["length"] for m in messages]
    avg_len = sum(lengths) / total
    texts = [m["text"] for m in messages]

    # --- Time analysis ---
    hours = defaultdict(int)
    months = defaultdict(int)
    for m in messages:
        if m["ts"] <= 0:
            continue
        dt = datetime.fromtimestamp(m["ts"] / 1000, tz=timezone(timedelta(hours=8)))
        hours[dt.hour] += 1
        months[dt.strftime("%Y-%m")] += 1

    period_msgs = {"morning": [], "afternoon": [], "evening": [], "night": []}
    for m in messages:
        if m["ts"] <= 0:
            continue
        dt = datetime.fromtimestamp(m["ts"] / 1000, tz=timezone(timedelta(hours=8)))
        h = dt.hour
        if 6 <= h < 12:
            period_msgs["morning"].append(m)
        elif 12 <= h < 18:
            period_msgs["afternoon"].append(m)
        elif 18 <= h < 24:
            period_msgs["evening"].append(m)
        else:
            period_msgs["night"].append(m)

    # --- Length distribution ---
    len_bins = {"≤1": 0, "≤5": 0, "≤10": 0, "≤20": 0, "≤50": 0, "≤100": 0, "≤200": 0, ">200": 0}
    for l in lengths:
        if l <= 1: len_bins["≤1"] += 1
        elif l <= 5: len_bins["≤5"] += 1
        elif l <= 10: len_bins["≤10"] += 1
        elif l <= 20: len_bins["≤20"] += 1
        elif l <= 50: len_bins["≤50"] += 1
        elif l <= 100: len_bins["≤100"] += 1
        elif l <= 200: len_bins["≤200"] += 1
        else: len_bins[">200"] += 1

    # --- Word frequency (jieba) ---
    all_words = []
    for t in texts:
        clean = re.sub(r'\[.*?\]', '', t)
        words = jieba.cut(clean)
        all_words.extend(w for w in words if len(w) >= 1 and not PUNCT_RE.match(w) and w.strip() and w not in STOP_WORDS)
    word_freq = Counter(all_words).most_common(100)

    # --- Bigram frequency ---
    bigrams = []
    for t in texts:
        clean = re.sub(r'\[.*?\]', '', t)
        chars = CJK_RE.findall(clean)
        for i in range(len(chars) - 1):
            bigrams.append(chars[i] + chars[i + 1])
    bigram_freq = Counter(bigrams).most_common(60)

    # --- Punctuation ---
    punct_count = Counter()
    for t in texts:
        for ch in t:
            if PUNCT_RE.match(ch):
                punct_count[ch] += 1

    # --- Emoji ---
    emoji_count = Counter()
    for t in texts:
        for ch in t:
            if EMOJI_RE.match(ch):
                emoji_count[ch] += 1

    # --- Sentence endings (last 2 chars) ---
    endings = Counter()
    for t in texts:
        clean = t.strip()
        if len(clean) >= 2:
            endings[clean[-2:]] += 1
        elif len(clean) == 1:
            endings[clean] += 1

    # --- Message openings (first 3 chars, after stripping system tags) ---
    openings = Counter()
    for t in texts:
        clean = re.sub(r'\[.*?\]', '', t).strip()
        if len(clean) >= 3:
            openings[clean[:3]] += 1
        elif len(clean) >= 1:
            openings[clean] += 1

    # --- Type distribution ---
    type_dist = Counter(m["type"] for m in messages)

    # --- Specific markers ---
    question_count = sum(1 for t in texts if "?" in t or "？" in t)
    exclamation_count = sum(1 for t in texts if "!" in t or "！" in t)
    ellipsis_count = sum(1 for t in texts if "…" in t or "..." in t)

    hhh_count = sum(len(re.findall(r'hhh+', t, re.I)) for t in texts)
    haha_count = sum(len(re.findall(r'哈哈+', t)) for t in texts)
    empty_bracket = sum(1 for t in texts if "（）" in t)
    miao_count = sum(1 for t in texts if "喵" in t)
    enen_count = sum(len(re.findall(r'嗯嗯+', t)) for t in texts)
    cao_count = sum(1 for t in texts if "草了" in t)
    nanbeng_count = sum(1 for t in texts if "南蚌" in t)
    meizhao_count = sum(1 for t in texts if "没招了" in t)
    yysy_count = sum(1 for t in texts if "有一说一" in t)
    woganjue_count = sum(1 for t in texts if re.search(r'我(感觉|觉得|认为|想)', t))
    reply_count = sum(1 for m in messages if m["type"] == "reply")

    # --- Monthly stats ---
    monthly_stats = defaultdict(lambda: {"total": 0, "avg_len": 0})
    for m in messages:
        if m["ts"] > 0:
            dt = datetime.fromtimestamp(m["ts"] / 1000, tz=timezone(timedelta(hours=8)))
            monthly_stats[dt.strftime("%Y-%m")]["total"] += 1
    for mk in list(monthly_stats.keys()):
        ms = [m for m in messages if m["ts"] > 0 and
              datetime.fromtimestamp(m["ts"]/1000, tz=timezone(timedelta(hours=8))).strftime("%Y-%m") == mk]
        monthly_stats[mk]["avg_len"] = round(sum(m["length"] for m in ms) / max(len(ms), 1), 1)

    # --- Time period word analysis ---
    period_words = {}
    pn_map = {"morning": "早晨(6-12)", "afternoon": "下午(12-18)", "evening": "晚间(18-24)", "night": "深夜(0-6)"}
    for pn, plabel in pn_map.items():
        pmsgs = period_msgs.get(pn, [])
        if not pmsgs:
            continue
        pt = [m["text"] for m in pmsgs]
        pw = []
        for t in pt:
            clean = re.sub(r'\[.*?\]', '', t)
            words = jieba.cut(clean)
            pw.extend(w for w in words if len(w) >= 2 and not PUNCT_RE.match(w) and w not in STOP_WORDS and w.strip())
        period_words[pn] = {
            "count": len(pmsgs),
            "avg_len": round(sum(m["length"] for m in pmsgs) / max(len(pmsgs), 1), 1),
            "top_words": Counter(pw).most_common(20),
        }

    # --- Time range ---
    valid_ts = [m["ts"] for m in messages if m["ts"] > 0]
    time_range = {}
    if valid_ts:
        time_range = {
            "start": datetime.fromtimestamp(min(valid_ts)/1000, tz=timezone(timedelta(hours=8))).isoformat(),
            "end": datetime.fromtimestamp(max(valid_ts)/1000, tz=timezone(timedelta(hours=8))).isoformat(),
        }

    return {
        "group": group_info["name"],
        "mirror_name": group_info["mirror_name"],
        "total": total,
        "avg_len": round(avg_len, 1),
        "median_len": sorted(lengths)[len(lengths)//2],
        "max_len": max(lengths),
        "len_distribution": len_bins,
        "hours": {str(k): v for k, v in sorted(hours.items())},
        "months": {k: v for k, v in sorted(months.items())},
        "word_freq": word_freq[:80],
        "bigram_freq": bigram_freq[:50],
        "punct_count": {k: v for k, v in punct_count.most_common(30)},
        "emoji_count": {k: v for k, v in emoji_count.most_common(20)},
        "endings": {k: v for k, v in endings.most_common(40)},
        "openings": {k: v for k, v in openings.most_common(40)},
        "type_dist": dict(type_dist),
        "question_count": question_count,
        "exclamation_count": exclamation_count,
        "ellipsis_count": ellipsis_count,
        "markers": {
            "hhh": hhh_count,
            "haha": haha_count,
            "empty_bracket": empty_bracket,
            "miao": miao_count,
            "enen": enen_count,
            "cao_le": cao_count,
            "nanbeng": nanbeng_count,
            "meizhao_le": meizhao_count,
            "yysy": yysy_count,
            "wo_ganjue": woganjue_count,
            "reply": reply_count,
        },
        "monthly_stats": {k: v for k, v in sorted(monthly_stats.items())},
        "period_analysis": period_words,
        "time_range": time_range,
    }


def format_markdown(a):
    """Convert analysis dict to markdown report."""
    if "error" in a:
        return f"# Error: {a['error']}\n"

    md = []
    md.append(f"# 澪号 — 数据档案 · QQ群聊分析（{a['group']}）")
    md.append("")
    md.append(f"> Mirror 身份：{a.get('mirror_name', 'Unknown')}")
    md.append(f"> 总发言：{a['total']} 条 | 平均长度：{a['avg_len']} 字符 | 中位数：{a['median_len']} 字符")
    tr = a.get("time_range", {})
    if tr:
        md.append(f"> 时间范围：{tr.get('start', '?')[:10]} ~ {tr.get('end', '?')[:10]}")
    md.append("")

    # 1. Basic stats
    md.append("## 一、基础数据")
    md.append("")
    ld = a["len_distribution"]
    t = a["total"]
    under5 = ld.get('≤1', 0) + ld.get('≤5', 0)
    md.append("| 维度 | 数据 |")
    md.append("|------|------|")
    md.append(f"| 总消息 | {t} 条 |")
    md.append(f"| 平均长度 | {a['avg_len']} 字符 |")
    md.append(f"| 中位长度 | {a['median_len']} 字符 |")
    md.append(f"| 最长消息 | {a['max_len']} 字符 |")
    md.append(f"| ≤5字 | {under5} 条 ({round(under5/t*100, 1)}%) |")
    md.append(f"| ≤10字 | {ld.get('≤10', 0)} 条 ({round(ld.get('≤10',0)/t*100, 1)}%) |")
    md.append(f"| ≤50字 | {ld.get('≤50', 0)} 条 ({round(ld.get('≤50',0)/t*100, 1)}%) |")
    md.append(f"| >200字 | {ld.get('>200', 0)} 条 ({round(ld.get('>200',0)/t*100, 1)}%) |")
    md.append("")

    md.append("### 消息类型分布")
    md.append("")
    for tp, c in sorted(a["type_dist"].items(), key=lambda x: -x[1]):
        md.append(f"- **{tp}**: {c} 条 ({round(c/t*100, 1)}%)")
    md.append("")

    # 2. Active time
    md.append("## 二、活跃时间")
    md.append("")
    hours = a["hours"]
    md.append("| 时段 | 消息量 | 占比 |")
    md.append("|------|--------|------|")
    for h in range(24):
        c = int(hours.get(str(h), 0))
        pct = round(c / t * 100, 1) if t > 0 else 0
        bar = "█" * max(1, int(pct))
        md.append(f"| {h:02d}:00 | {c} | {pct}% {bar} |")
    md.append("")

    # Period summary
    md.append("### 时段汇总")
    md.append("")
    pn_map = {"morning": "早晨(6-12)", "afternoon": "下午(12-18)", "evening": "晚间(18-24)", "night": "深夜(0-6)"}
    for pn, plabel in pn_map.items():
        if pn in a.get("period_analysis", {}):
            pd = a["period_analysis"][pn]
            top8 = [f"{w}({c}次)" for w, c in pd["top_words"][:8]]
            md.append(f"- **{plabel}**：{pd['count']} 条，均长 {pd['avg_len']} 字")
            md.append(f"  → {', '.join(top8)}")
    md.append("")

    # Monthly trend
    md.append("### 月度趋势（近12个月）")
    md.append("")
    ms = a.get("monthly_stats", {})
    recent = list(ms.items())[-12:]
    for mk, mv in recent:
        bar = "█" * max(1, int(mv["total"] // 10))
        md.append(f"- {mk}: {mv['total']} 条 (均长 {mv['avg_len']}) {bar}")
    md.append("")

    # 3. Word frequency
    md.append("## 三、高频词汇 Top 60")
    md.append("")
    md.append("| 词 | 次数 | 词 | 次数 |")
    md.append("|------|------|------|------|")
    wf = a["word_freq"][:60]
    for i in range(0, len(wf), 2):
        left = f"{wf[i][0]} | {wf[i][1]}"
        right = f"{wf[i+1][0]} | {wf[i+1][1]}" if i + 1 < len(wf) else " | "
        md.append(f"| {left} | {right} |")
    md.append("")

    # 4. Bigrams
    md.append("## 四、高频词对 Top 30")
    md.append("")
    md.append("| 词对 | 次数 | 词对 | 次数 |")
    md.append("|------|------|------|------|")
    bf = a["bigram_freq"][:30]
    for i in range(0, len(bf), 2):
        left = f"{bf[i][0]} | {bf[i][1]}"
        right = f"{bf[i+1][0]} | {bf[i+1][1]}" if i + 1 < len(bf) else " | "
        md.append(f"| {left} | {right} |")
    md.append("")

    # 5. Punctuation
    md.append("## 五、标点习惯")
    md.append("")
    md.append("| 标点 | 次数 |")
    md.append("|------|------|")
    for p, c in a["punct_count"].items():
        md.append(f"| {p} | {c} |")
    md.append("")

    # 6. Endings
    md.append("## 六、句末模式 Top 25")
    md.append("")
    md.append("| 结尾 | 次数 |")
    md.append("|------|------|")
    for e, c in list(a["endings"].items())[:25]:
        md.append(f"| {e} | {c} |")
    md.append("")

    # 7. Openings
    md.append("## 七、消息开头 Top 25")
    md.append("")
    md.append("| 开头 | 次数 |")
    md.append("|------|------|")
    for o, c in list(a["openings"].items())[:25]:
        md.append(f"| {o} | {c} |")
    md.append("")

    # 8. Emoji
    md.append("## 八、Emoji 使用")
    md.append("")
    if a["emoji_count"]:
        for e, c in list(a["emoji_count"].items())[:15]:
            md.append(f"- {e}: {c} 次")
    else:
        md.append("(几乎不使用 emoji)")
    md.append("")

    # 9. Markers
    md.append("## 九、语言标记")
    md.append("")
    m = a["markers"]
    md.append("| 标记 | 次数 | 占比 | 解读 |")
    md.append("|------|------|------|------|")
    def row(label, key, note):
        val = m.get(key, 0)
        pct = f"{round(val/t*100, 1)}%" if t > 0 else "0%"
        md.append(f"| {label} | {val} | {pct} | {note} |")
    row("hhh", "hhh", "笑声-小写非正式")
    row("哈哈哈", "haha", "笑声-较正式")
    row("空白括号（）", "empty_bracket", "无言吐槽符号")
    row("喵", "miao", "亲昵信号")
    row("嗯嗯", "enen", "双重确认")
    row("草了", "cao_le", "轻度吐槽")
    row("南蚌", "nanbeng", "轻度吐槽")
    row("没招了", "meizhao_le", "轻度吐槽")
    row("有一说一", "yysy", "公平标记")
    row("我感觉/觉得", "wo_ganjue", "主观表达")
    row("回复消息", "reply", "引用回复")
    row("疑问句(含?/？)", "use_qmark", "疑问")
    row("感叹句(含!/！)", "use_emark", "感叹")
    row("省略/犹豫(含…)", "use_ellipsis", "停顿犹豫")
    md.append("")
    md.append(f"- 疑问句: {a.get('question_count', 0)} 条")
    md.append(f"- 感叹句: {a.get('exclamation_count', 0)} 条")
    md.append(f"- 含省略号: {a.get('ellipsis_count', 0)} 条")
    md.append("")

    # 10. Period features
    md.append("## 十、时段语言特征")
    md.append("")
    for pn, plabel in [("morning", "早晨(6-12)"), ("afternoon", "下午(12-18)"), ("evening", "晚间(18-24)"), ("night", "深夜(0-6)")]:
        if pn not in a.get("period_analysis", {}):
            continue
        pd = a["period_analysis"][pn]
        md.append(f"### {plabel} ({pd['count']}条, 均长{pd['avg_len']}字)")
        md.append("")
        for w, c in pd["top_words"][:15]:
            md.append(f"- {w}: {c}")
        md.append("")

    return "\n".join(md)


def main():
    print("=" * 60)
    print("QQ Group Chat Analysis for Mirror")
    print("=" * 60)

    all_results = {}

    for cfg in GROUP_CONFIG:
        gkey = cfg["key"]
        gname = cfg["name"]
        expected = cfg["expected"]

        print(f"\nProcessing: {gname} (key={gkey})...")
        gdir = find_group_dir(cfg["dir_match"])

        if not gdir:
            print(f"  WARNING: Directory not found for '{cfg['dir_match']}'")
            continue

        print(f"  Found: {os.path.basename(gdir)}")
        messages, group_info = extract_mirror_messages(gdir)
        print(f"  Extracted {len(messages)} Mirror messages (expected ~{expected})")

        if not messages:
            print(f"  SKIPPING - no messages found")
            continue

        analysis = analyze_messages(messages, group_info)

        # Save JSON
        json_path = os.path.join(OUT_DIR, f"group-{gkey}-analysis.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(analysis, f, ensure_ascii=False, indent=2, default=str)
        print(f"  Saved: {json_path}")

        # Save Markdown
        md = format_markdown(analysis)
        md_path = os.path.join(OUT_DIR, f"group-{gkey}-analysis.md")
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(md)
        print(f"  Saved: {md_path}")

        all_results[gname] = analysis

    # --- Cross-group comparison ---
    print(f"\n{'='*60}")
    print("Generating cross-group comparison...")

    valid_results = {k: v for k, v in all_results.items() if "error" not in v}
    if len(valid_results) < 2:
        print("Not enough valid results for comparison, skipping.")
        return

    cmp = []
    cmp.append("# 澪号 — 群聊分析 · 跨群对比报告")
    cmp.append("")
    cmp.append("> Mirror 在五个 QQ 群中的语言行为对比")
    cmp.append("")

    # Basic comparison
    cmp.append("## 一、基础数据对比")
    cmp.append("")
    cmp.append("| 群 | Mirror身份 | 发言数 | 均长 | 中位长 | 时间跨度 |")
    cmp.append("|------|------|------|------|------|------|")
    for gname, a in valid_results.items():
        tr = a.get("time_range", {})
        span = f"{tr.get('start', '?')[:10]}~{tr.get('end', '?')[:10]}" if tr else "?"
        cmp.append(f"| {gname} | {a.get('mirror_name', '?')} | {a['total']} | {a['avg_len']} | {a['median_len']} | {span} |")
    cmp.append("")

    # Length distribution
    cmp.append("## 二、消息长度分布对比")
    cmp.append("")
    cmp.append("| 群 | ≤5字 | ≤10字 | ≤20字 | >100字 |")
    cmp.append("|------|------|------|------|------|")
    for gname, a in valid_results.items():
        ld = a["len_distribution"]
        t = a["total"]
        under5 = ld.get('≤1', 0) + ld.get('≤5', 0)
        cmp.append(f"| {gname} | {round(under5/t*100)}% | {round(ld.get('≤10',0)/t*100)}% | {round(ld.get('≤20',0)/t*100)}% | {round(ld.get('>100',0)/t*100)}% |")
    cmp.append("")

    # Activity peaks
    cmp.append("## 三、活跃高峰对比")
    cmp.append("")
    for gname, a in valid_results.items():
        hrs = a["hours"]
        sorted_hrs = sorted(hrs.items(), key=lambda x: -x[1])
        peak = sorted_hrs[0] if sorted_hrs else ("?", 0)
        second = sorted_hrs[1] if len(sorted_hrs) > 1 else ("?", 0)
        evening_total = sum(v for k, v in hrs.items() if 18 <= int(k) <= 23)
        cmp.append(f"- **{gname}**：高峰 {peak[0]}:00 ({peak[1]}条)，次高峰 {second[0]}:00 ({second[1]}条)，晚间占比 {round(evening_total/a['total']*100)}%")
    cmp.append("")

    # Language markers
    cmp.append("## 四、关键语言标记对比")
    cmp.append("")
    marker_keys = [
        ("hhh", "hhh"),
        ("喵", "miao"),
        ("嗯嗯", "enen"),
        ("空括号（）", "empty_bracket"),
        ("有一说一", "yysy"),
        ("草了", "cao_le"),
        ("南蚌", "nanbeng"),
        ("没招了", "meizhao_le"),
        ("我感觉/觉得", "wo_ganjue"),
        ("回复", "reply"),
    ]
    headers = "| 标记 | " + " | ".join(gn for gn in valid_results) + " |"
    sep = "|------|" + "|".join(["------"] * len(valid_results)) + "|"
    cmp.append(headers)
    cmp.append(sep)
    for label, key in marker_keys:
        row = f"| {label} |"
        for gname in valid_results:
            a = valid_results[gname]
            val = a["markers"].get(key, 0)
            row += f" {val} |"
        cmp.append(row)
    cmp.append("")

    # Group vs private comparison
    cmp.append("## 五、群聊 vs 私聊 关键差异")
    cmp.append("")
    cmp.append("| 维度 | 私聊(小朔) | " + " | ".join(gn for gn in valid_results) + " |")
    cmp.append("|------|------|" + "|".join(["------"] * len(valid_results)) + "|")
    rules = [
        ("均长(字)", "avg_len", 26),
        ("hhh次数", "markers.hhh", 51),
        ("喵次数", "markers.miao", 12),
        ("嗯嗯次数", "markers.enen", 59),
        ("空括号（）", "markers.empty_bracket", 42),
        ("感叹号(!/！)", "exclamation_count", 4),
        ("问号(?/？)", "question_count", 25),
        ("≤10字占比", "pct_short", 58.7),
    ]
    for label, key, pv in rules:
        row = f"| {label} | {pv} |"
        for gname in valid_results:
            a = valid_results[gname]
            if key == "pct_short":
                ld = a["len_distribution"]
                val = f"{round((ld.get('≤1',0)+ld.get('≤5',0)+ld.get('≤10',0))/a['total']*100)}%"
            elif key.startswith("markers."):
                val = a["markers"][key.split(".")[1]]
            else:
                val = a.get(key, 0)
            row += f" {val} |"
        cmp.append(row)
    cmp.append("")

    # Unique per-group vocabulary
    cmp.append("## 六、各群特有高频词（Top 30中其他群不常见的）")
    cmp.append("")
    for gname, a in valid_results.items():
        my_words = set(w for w, c in a["word_freq"][:30])
        other_words = set()
        for gn2, a2 in valid_results.items():
            if gn2 == gname:
                continue
            other_words.update(w for w, c in a2["word_freq"][:50])
        unique = [w for w, c in a["word_freq"] if w in my_words - other_words]
        if unique:
            cmp.append(f"- **{gname}**：{'、'.join(unique[:20])}")
        else:
            cmp.append(f"- **{gname}**：(所有高频词也出现在其他群中)")
    cmp.append("")

    compare_path = os.path.join(OUT_DIR, "group-cross-comparison.md")
    with open(compare_path, "w", encoding="utf-8") as f:
        f.write("\n".join(cmp))
    print(f"Saved cross comparison: {compare_path}")

    print(f"\n{'='*60}")
    print("Analysis complete!")
    for gname, a in valid_results.items():
        print(f"  {gname}: {a['total']} messages")


if __name__ == "__main__":
    main()

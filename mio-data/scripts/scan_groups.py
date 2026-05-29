import json, glob, os, sys, io

# Force UTF-8 output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

base = os.path.expandvars(r"C:\Users\Mirror\.qq-chat-exporter\exports")
pattern = os.path.join(base, "group_*")
for d in sorted(glob.glob(pattern)):
    mpath = os.path.join(d, "manifest.json")
    if not os.path.exists(mpath):
        continue
    m = json.load(open(mpath, encoding="utf-8"))
    ci = m["chatInfo"]
    s = m["statistics"]

    mirror = None
    for sender in s["senders"]:
        name = sender.get("name", "")
        if any(k in name for k in ["希儿", "夏目安安", "森亚露露卡"]):
            mirror = sender
            break

    print(f"Dir: {os.path.basename(d)}", flush=True)
    print(f"  Group: {ci['name']}", flush=True)
    print(f"  SelfName: {ci.get('selfName', 'N/A')}", flush=True)
    print(f"  SelfUid: {ci.get('selfUid', 'N/A')}", flush=True)
    print(f"  Total msgs: {s['totalMessages']:,}", flush=True)
    print(f"  Senders: {len(s['senders'])}", flush=True)
    print(f"  TimeRange: {s['timeRange']['start'][:10]} ~ {s['timeRange']['end'][:10]} ({s['timeRange']['durationDays']}d)", flush=True)
    if mirror:
        print(f"  Mirror: [{mirror['uid']}] {mirror['name']} = {mirror['messageCount']:,} msgs ({mirror['percentage']}%)", flush=True)
    else:
        print(f"  Mirror: NOT FOUND in {len(s['senders'])} senders", flush=True)
        for i, snd in enumerate(s["senders"][:10]):
            print(f"    [{snd['uid']}] {snd['name']}: {snd['messageCount']:,}", flush=True)
    print(f"  Chunks: {len(m['chunked']['chunks'])}", flush=True)
    for c in m["chunked"]["chunks"]:
        print(f"    chunk_{c['index']:04d}: {c['start'][:10]}~{c['end'][:10]}, {c['count']:,} msgs", flush=True)
    print(flush=True)

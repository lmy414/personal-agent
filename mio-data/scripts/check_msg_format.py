import json, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Read just the first message from chunk_0001
chunk_path = r"C:\Users\Mirror\.qq-chat-exporter\exports\group_1034791447_20260527_012133_chunked_jsonl\chunks\chunk_0001.jsonl"
with open(chunk_path, encoding="utf-8") as f:
    for i, line in enumerate(f):
        if i >= 3:
            break
        msg = json.loads(line)
        # Print all keys first
        print(f"=== Message {i} keys: {list(msg.keys())} ===")
        # Print message with truncated content fields
        for k, v in msg.items():
            s = str(v)
            if len(s) > 200:
                s = s[:200] + "..."
            print(f"  {k}: {s}")
        print()

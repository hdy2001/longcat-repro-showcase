#!/usr/bin/env python3
"""Run 4 GPT models via OpenRouter to each generate a 4-page consulting deck.
Measures wall-clock time and cost (credits) per model. Saves HTML + raw logs + metrics."""
import json
import os
import re
import threading
import time
import urllib.request
import urllib.error

WS = os.path.dirname(os.path.abspath(__file__))
KEY = None
for line in open(os.path.expanduser("~/.claude/openrouter-kimi.env")):
    if line.startswith("export ANTHROPIC_AUTH_TOKEN="):
        KEY = line.split('"')[1]
assert KEY, "no key"
PROMPT = open(os.path.join(WS, "prompt_gen.txt"), encoding="utf-8").read()
LOGDIR = os.path.join(WS, "logs")
DECKDIR = os.path.join(WS, "decks")
os.makedirs(LOGDIR, exist_ok=True)
os.makedirs(DECKDIR, exist_ok=True)

MODELS = [
    {"slug": "gpt56_sol_high",    "label": "GPT 5.6 Sol high",    "id": "openai/gpt-5.6-sol",  "effort": "high"},
    {"slug": "gpt56_terra_high",  "label": "GPT 5.6 Terra high",  "id": "openai/gpt-5.6-terra", "effort": "high"},
    {"slug": "gpt56_luna_max",    "label": "GPT 5.6 Luna max",    "id": "openai/gpt-5.6-luna", "effort": "max"},
    {"slug": "gpt6_astra_high",   "label": "GPT 6 Astra high",    "id": "openai/gpt-6-astra",  "effort": "high"},
]
URL = "https://openrouter.ai/api/v1/chat/completions"

lock = threading.Lock()
results = {}


def log(msg):
    with lock:
        print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def call_model(m, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(URL, data=data, method="POST", headers={
        "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req, timeout=560) as resp:
        return json.loads(resp.read().decode())


def run_model(m):
    t0 = time.time()
    calls = []
    body = {
        "model": m["id"],
        "messages": [{"role": "user", "content": PROMPT}],
        "reasoning": {"effort": m["effort"]},
        "max_tokens": 30000,
    }
    for attempt in range(5):
        try:
            ts = time.time()
            r = call_model(m, body)
            wall = time.time() - ts
            ch = r["choices"][0]
            u = r.get("usage", {})
            ct = (u.get("completion_tokens_details") or {})
            calls.append({
                "model_id": r.get("model"),
                "wall_s": round(wall, 3),
                "finish_reason": ch.get("finish_reason"),
                "prompt_tokens": u.get("prompt_tokens"),
                "completion_tokens": u.get("completion_tokens"),
                "reasoning_tokens": ct.get("reasoning_tokens", 0),
                "cost_usd": u.get("cost"),
            })
            log(f"{m['label']}: call#{len(calls)} done in {wall:.1f}s, "
                f"tokens in/out={u.get('prompt_tokens')}/{u.get('completion_tokens')} "
                f"(reason={ct.get('reasoning_tokens', 0)}), cost=${u.get('cost')}, finish={ch.get('finish_reason')}")
            with open(os.path.join(LOGDIR, m["slug"] + f".call{len(calls)}.json"), "w", encoding="utf-8") as f:
                json.dump(r, f, ensure_ascii=False, indent=1)
            content = ch["message"]["content"]
            finish = ch.get("finish_reason")
            if finish == "length" and len(calls) < 2:
                # continuation: ask for remaining slides in a follow-up call
                body["messages"].append({"role": "assistant", "content": content})
                body["messages"].append({"role": "user", "content":
                    "输出被截断。请从中断处继续，输出剩余页的完整 HTML（不要重复已输出的内容，不要解释，直接输出 HTML 续文）。"})
                continue
            break
        except urllib.error.HTTPError as e:
            body_txt = e.read().decode()[:300]
            log(f"{m['label']}: HTTP {e.code} attempt#{attempt+1}: {body_txt}")
            if e.code == 400:
                raise
            time.sleep(10 * (attempt + 1))
        except Exception as e:
            log(f"{m['label']}: error attempt#{attempt+1}: {e}")
            time.sleep(10 * (attempt + 1))
    total = time.time() - t0
    # strip code fences if the model wrapped the HTML
    content = content.strip()
    if content.startswith("```"):
        content = re.sub(r"^```[a-zA-Z]*\s*", "", content)
        content = re.sub(r"\s*```$", "", content).strip()
    html_path = os.path.join(DECKDIR, m["slug"] + ".html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(content)
    ok = ('class="slide"' in content or "class='slide'" in content) and "<html" in content.lower()
    nslides = content.count('class="slide"') + content.count("class='slide'")
    log(f"{m['label']}: saved {html_path} ({len(content)} chars, slides={nslides}, valid={ok}), total {total:.1f}s")
    results[m["slug"]] = {
        "label": m["label"], "model_id": m["id"], "effort": m["effort"],
        "total_wall_s": round(total, 3), "calls": calls,
        "cost_usd": round(sum(c["cost_usd"] or 0 for c in calls), 6),
        "prompt_tokens": sum(c["prompt_tokens"] or 0 for c in calls),
        "completion_tokens": sum(c["completion_tokens"] or 0 for c in calls),
        "reasoning_tokens": sum(c["reasoning_tokens"] or 0 for c in calls),
        "html": html_path, "html_chars": len(content), "nslides": nslides, "valid_html": ok,
    }


threads = [threading.Thread(target=run_model, args=(m,), daemon=True) for m in MODELS]
for t in threads:
    t.start()
for t in threads:
    t.join()

with open(os.path.join(WS, "metrics.json"), "w", encoding="utf-8") as f:
    json.dump({"generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
               "prompt_file": "prompt_gen.txt",
               "notes": "wall_s=API 生成调用墙钟时间(含重试), 不含本地渲染; cost_usd=OpenRouter usage.cost",
               "models": results}, f, ensure_ascii=False, indent=1)
log("ALL DONE -> metrics.json")

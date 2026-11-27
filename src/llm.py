"""Minimal client for llama-server's OpenAI-compatible API (no extra dependencies)."""
import json
import os
import time
import urllib.request

from .config import cfg


def chat(model_key: str, messages: list, max_tokens=1024, temperature=0, seed=None, stop=None, prefill=None) -> dict:
    """stop: optional list of stop strings. prefill: text the assistant reply starts with (sent as a trailing
    assistant message; the server continues it; our llama-server build returns the prefill as the start of the text)."""
    m = cfg()["models"][model_key]
    if prefill:
        messages = messages + [{"role": "assistant", "content": prefill}]
    body = {"model": m["name"], "messages": messages,
            "max_tokens": max_tokens, "temperature": temperature}
    if seed is not None:
        body["seed"] = seed
    if stop:
        body["stop"] = list(stop)
    log = os.environ.get("STREAMCODER_LOG_REQUESTS")
    if log:  # debug aid, off by default: one JSON line per request
        try:
            with open(log, "a") as f:
                f.write(json.dumps({"model": body["model"], "temperature": temperature, "seed": seed,
                                    "max_tokens": max_tokens,
                                    "messages": [{"role": x["role"], "head": x["content"][:80]} for x in messages]}) + "\n")
        except OSError:
            pass
    req = urllib.request.Request(f"{m['url']}/chat/completions", json.dumps(body).encode(),
                                 {"Content-Type": "application/json"})
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=600) as r:
        data = json.load(r)
    usage = data.get("usage", {})
    secs = time.time() - t0
    return {
        "text": data["choices"][0]["message"]["content"],
        "finish_reason": data["choices"][0].get("finish_reason"),
        "seconds": round(secs, 2),
        "prompt_tokens": usage.get("prompt_tokens"),
        "completion_tokens": usage.get("completion_tokens"),
        "tokens_per_sec": round((usage.get("completion_tokens") or 0) / secs, 1) if secs else None,
    }

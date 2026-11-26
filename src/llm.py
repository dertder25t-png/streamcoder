"""Minimal client for llama-server's OpenAI-compatible API (no extra dependencies)."""
import json
import time
import urllib.request

from .config import cfg


def chat(model_key: str, messages: list, max_tokens=1024, temperature=0.2) -> dict:
    m = cfg()["models"][model_key]
    body = {"model": m["name"], "messages": messages,
            "max_tokens": max_tokens, "temperature": temperature}
    req = urllib.request.Request(f"{m['url']}/chat/completions", json.dumps(body).encode(),
                                 {"Content-Type": "application/json"})
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=600) as r:
        data = json.load(r)
    usage = data.get("usage", {})
    secs = time.time() - t0
    return {
        "text": data["choices"][0]["message"]["content"],
        "seconds": round(secs, 2),
        "prompt_tokens": usage.get("prompt_tokens"),
        "completion_tokens": usage.get("completion_tokens"),
        "tokens_per_sec": round((usage.get("completion_tokens") or 0) / secs, 1) if secs else None,
    }

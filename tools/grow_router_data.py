"""Grow the router's training data using your local LLM (needs llama-server running).

The router is only as good as its examples. With ~17 per pack it guesses right
about half the time; aim for 60+ per pack. This asks the model to write realistic
requests for each pack and difficulty, then appends them for you to review.

  python tools/grow_router_data.py --per 20
  # review data/router/generated.jsonl, delete bad lines, then:
  cat data/router/generated.jsonl >> data/router/seed.jsonl && python -m src.router train

Even better: add real prompts you actually type, labeled by hand.
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from src import llm  # noqa: E402
from src.config import path  # noqa: E402

PACKS = {
    "typescript": "TypeScript types, generics and type errors",
    "react": "React components, hooks and state",
    "node": "Node.js scripts, files, streams and HTTP servers",
    "general": "general programming concepts, git and software design (no specific language)",
}
LEVEL = {"easy": "beginner questions or small fixes",
         "hard": "multi-step tasks, debugging tricky errors or design questions"}


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--per", type=int, default=20, help="examples per pack per difficulty")
    ap.add_argument("--model", default="7b")
    a = ap.parse_args(argv)
    out = path("data/router/generated.jsonl")
    n = 0
    with out.open("a") as f:
        for pack, desc in PACKS.items():
            for level, ldesc in LEVEL.items():
                msg = (f"Write {a.per} different messages a programmer might send to a coding "
                       f"assistant about {desc}. They should be {ldesc}. Vary the wording; some "
                       f"short and casual, some with error messages. One per line, no numbering.")
                text = llm.chat(a.model, [{"role": "user", "content": msg}], temperature=0.9)["text"]
                for line in text.splitlines():
                    line = line.strip().lstrip("-*0123456789.) ").strip('"')
                    if 8 < len(line) < 300:
                        f.write(json.dumps({"text": line, "pack": pack, "difficulty": level}) + "\n")
                        n += 1
    print(f"wrote {n} examples -> {out}. Review before merging into seed.jsonl")


if __name__ == "__main__":
    sys.exit(main())

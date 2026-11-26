# Library sources and licenses

| Folder | Source | License |
|---|---|---|
| `*/patterns.md`, `*/hooks.md`, etc. | Hand-written for this project | Yours |
| `react/docs/` | react.dev (github.com/reactjs/react.dev) | CC BY 4.0 |
| `typescript/docs/` | TypeScript Handbook (github.com/microsoft/TypeScript-Website) | CC BY 4.0 |
| `node/docs/` | Node.js API docs (github.com/nodejs/node, doc/api) | MIT |
| `data/router/seed.jsonl` rows with a stackoverflow.com `source` | Stack Overflow | CC BY-SA 4.0 |

The `docs/` folders are downloaded by `tools/fetch_docs.py` and are not committed.
Rule: nothing in the library may contain a solution to an eval task (data/eval/).

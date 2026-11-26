# Cancel async work with AbortController
```ts
const ctrl = new AbortController();
const t = setTimeout(() => ctrl.abort(new Error("timeout")), 5000);
try { await fetch(url, { signal: ctrl.signal }); } finally { clearTimeout(t); }
```
Shortcut: `AbortSignal.timeout(5000)`. Check `signal.aborted` before starting new work and listen with `signal.addEventListener("abort", fn, { once: true })`; remove listeners when done.

# Limit concurrency
Keep a counter of active jobs and a next-index pointer; when a job settles, start the next one. Store results by index so output order matches input order. `Promise.all` alone starts everything at once.

# Wait for an event with a timeout
```ts
import { once } from "node:events";
const [payload] = await once(emitter, "ready", { signal: AbortSignal.timeout(3000) });
```
`events.once` removes its listeners on resolve, reject, or abort.

# Minimal HTTP server
```ts
import { createServer } from "node:http";
const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/health") { res.writeHead(200, { "content-type": "text/plain" }); return res.end("ok"); }
  res.writeHead(404).end();
});
server.listen(0, () => console.log((server.address() as import("node:net").AddressInfo).port));
```
Graceful shutdown: `server.close(cb)` stops new connections; `server.closeIdleConnections()` (Node 18.2+) drops idle keep-alive sockets.

# Unhandled rejections
Every promise needs a handler. In loops use `await Promise.allSettled(...)` when some failures are acceptable; with `Promise.all`, attach handlers before awaiting so later rejections aren't unhandled.

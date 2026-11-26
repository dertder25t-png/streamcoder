import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, expect, it } from "vitest";
import { createIdempotencyWrapper } from "./solution";

const servers: Server[] = [];
afterEach(async () => {
  for (const s of servers.splice(0)) {
    s.closeAllConnections();
    await new Promise((r) => s.close(r));
  }
});

type H = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

async function start(handler: H, opts: { ttlMs: number; now: () => number }): Promise<string> {
  const wrapped = (createIdempotencyWrapper as any)(opts)(handler) as H;
  const server = createServer((req, res) => {
    wrapped(req, res).catch(() => {
      if (!res.headersSent) res.statusCode = 500;
      res.end();
    });
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const post = (url: string, key: string, body: string) =>
  fetch(url, { method: "POST", headers: { "idempotency-key": key, "content-type": "application/json" }, body });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function countingHandler() {
  const state = { calls: 0 };
  const handler: H = async (_req, res) => {
    const n = ++state.calls;
    await sleep(40);
    res.statusCode = 201;
    res.setHeader("content-type", "application/json");
    res.setHeader("x-call", String(n));
    res.end(JSON.stringify({ call: n }));
  };
  return { state, handler };
}

it("concurrent requests with the same key run the handler once and share the response", async () => {
  const { state, handler } = countingHandler();
  const url = await start(handler, { ttlMs: 60_000, now: () => 0 });
  const [a, b] = await Promise.all([post(url, "k1", '{"x":1}'), post(url, "k1", '{"x":1}')]);
  expect(state.calls).toBe(1);
  expect(a.status).toBe(201);
  expect(b.status).toBe(201);
  expect(await a.json()).toEqual({ call: 1 });
  expect(await b.json()).toEqual({ call: 1 });
  expect(b.headers.get("x-call")).toBe("1");
});

it("replays status, headers and body for a later retry without re-running the handler", async () => {
  const { state, handler } = countingHandler();
  const url = await start(handler, { ttlMs: 60_000, now: () => 0 });
  const first = await post(url, "k2", "same");
  const second = await post(url, "k2", "same");
  expect(state.calls).toBe(1);
  expect(second.status).toBe(201);
  expect(second.headers.get("x-call")).toBe("1");
  expect(second.headers.get("content-type")).toContain("application/json");
  expect(await second.text()).toBe(await first.text());
});

it("different keys execute independently", async () => {
  const { state, handler } = countingHandler();
  const url = await start(handler, { ttlMs: 60_000, now: () => 0 });
  await post(url, "ka", "same");
  await post(url, "kb", "same");
  expect(state.calls).toBe(2);
});

it("returns 409 when a key is reused with a different body, without running the handler", async () => {
  const { state, handler } = countingHandler();
  const url = await start(handler, { ttlMs: 60_000, now: () => 0 });
  await post(url, "k3", '{"a":1}');
  const conflict = await post(url, "k3", '{"a":2}');
  expect(conflict.status).toBe(409);
  expect(state.calls).toBe(1);
  const replay = await post(url, "k3", '{"a":1}');
  expect(replay.status).toBe(201);
  expect(state.calls).toBe(1);
});

it("a 5xx response does not lock the key; a retry executes the handler again", async () => {
  let calls = 0;
  const handler: H = async (_req, res) => {
    calls++;
    res.statusCode = calls === 1 ? 503 : 200;
    res.end(calls === 1 ? "unavailable" : "ok");
  };
  const url = await start(handler, { ttlMs: 60_000, now: () => 0 });
  const first = await post(url, "k4", "b");
  expect(first.status).toBe(503);
  const second = await post(url, "k4", "b");
  expect(second.status).toBe(200);
  expect(await second.text()).toBe("ok");
  expect(calls).toBe(2);
  const third = await post(url, "k4", "b");
  expect(await third.text()).toBe("ok");
  expect(calls).toBe(2);
});

it("a throwing handler does not lock the key", async () => {
  let calls = 0;
  const handler: H = async (_req, res) => {
    calls++;
    if (calls === 1) throw new Error("boom");
    res.statusCode = 200;
    res.end("fine");
  };
  const url = await start(handler, { ttlMs: 60_000, now: () => 0 });
  const first = await post(url, "k5", "b");
  expect(first.status).toBeGreaterThanOrEqual(500);
  const second = await post(url, "k5", "b");
  expect(second.status).toBe(200);
  expect(await second.text()).toBe("fine");
  expect(calls).toBe(2);
});

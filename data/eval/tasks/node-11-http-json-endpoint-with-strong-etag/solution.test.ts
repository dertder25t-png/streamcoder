import { createServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, expect, it } from "vitest";
import { createConfigHandler } from "./solution";

let server: Server | undefined;
afterEach(async () => {
  if (server) {
    const s = server;
    server = undefined;
    s.closeAllConnections?.();
    await new Promise<void>((r) => s.close(() => r()));
  }
});

async function start(getConfig: () => unknown): Promise<string> {
  server = createServer(createConfigHandler(getConfig));
  await new Promise<void>((r) => server!.listen(0, "127.0.0.1", r));
  return `http://127.0.0.1:${(server!.address() as AddressInfo).port}/`;
}

it("returns 200 with JSON body, content type and a quoted ETag", async () => {
  const cfg = { name: "app", n: [1, 2, 3] };
  const url = await start(() => cfg);
  const res = await fetch(url);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toMatch(/^application\/json/);
  const etag = res.headers.get("etag")!;
  expect(etag).toMatch(/^"[^"]+"$/);
  expect(await res.json()).toEqual(cfg);
});

it("gives the same ETag for the same content and a different one for different content", async () => {
  let cfg: unknown = { v: 1 };
  const url = await start(() => cfg);
  const a = await fetch(url);
  await a.text();
  const b = await fetch(url);
  await b.text();
  expect(a.headers.get("etag")).toBe(b.headers.get("etag"));
  cfg = { v: 2 };
  const c = await fetch(url);
  await c.text();
  expect(c.headers.get("etag")).not.toBe(a.headers.get("etag"));
});

it("returns 304 with empty body and the ETag when If-None-Match matches", async () => {
  const url = await start(() => ({ v: 1 }));
  const first = await fetch(url);
  await first.text();
  const etag = first.headers.get("etag")!;
  const res = await fetch(url, { headers: { "If-None-Match": etag } });
  expect(res.status).toBe(304);
  expect(res.headers.get("etag")).toBe(etag);
  expect(await res.text()).toBe("");
});

it("matches ETags in a comma-separated list and the * wildcard", async () => {
  const url = await start(() => ({ v: 1 }));
  const first = await fetch(url);
  await first.text();
  const etag = first.headers.get("etag")!;
  const list = await fetch(url, { headers: { "If-None-Match": `"other", ${etag} , "third"` } });
  expect(list.status).toBe(304);
  expect(list.headers.get("etag")).toBe(etag);
  await list.text();
  const star = await fetch(url, { headers: { "If-None-Match": "*" } });
  expect(star.status).toBe(304);
  await star.text();
});

it("returns 200 for a non-matching If-None-Match", async () => {
  const url = await start(() => ({ v: 1 }));
  const res = await fetch(url, { headers: { "If-None-Match": '"nope", "nada"' } });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ v: 1 });
});

it("returns 200 with a fresh ETag after the config changes", async () => {
  let cfg: unknown = { v: 1 };
  const url = await start(() => cfg);
  const first = await fetch(url);
  await first.text();
  const oldTag = first.headers.get("etag")!;
  cfg = { v: 2 };
  const res = await fetch(url, { headers: { "If-None-Match": oldTag } });
  expect(res.status).toBe(200);
  expect(res.headers.get("etag")).not.toBe(oldTag);
  expect(await res.json()).toEqual({ v: 2 });
});

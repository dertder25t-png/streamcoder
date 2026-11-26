import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, expect, it } from "vitest";
import { createHealthServer } from "./solution";

let server: Server | undefined;
afterEach(async () => {
  if (server) {
    const s = server;
    server = undefined;
    s.closeAllConnections?.();
    await new Promise<void>((r) => s.close(() => r()));
  }
});

async function start(check: () => Promise<boolean>): Promise<string> {
  server = createHealthServer(check);
  await new Promise<void>((r) => server!.listen(0, "127.0.0.1", r));
  return `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
}

it("GET /live returns 200 JSON {status: ok} regardless of readiness", async () => {
  const base = await start(async () => false);
  const res = await fetch(base + "/live");
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toMatch(/^application\/json/);
  expect(await res.json()).toEqual({ status: "ok" });
});

it("GET /ready returns 200 when checkReady resolves true", async () => {
  const base = await start(async () => true);
  const res = await fetch(base + "/ready");
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toMatch(/^application\/json/);
  await res.json();
});

it("GET /ready returns 503 when checkReady resolves false", async () => {
  const base = await start(async () => false);
  const res = await fetch(base + "/ready");
  expect(res.status).toBe(503);
  await res.text();
});

it("GET /ready returns 503 when checkReady rejects", async () => {
  const base = await start(async () => {
    throw new Error("db down");
  });
  const res = await fetch(base + "/ready");
  expect(res.status).toBe(503);
  await res.text();
});

it("readiness is evaluated per request", async () => {
  let ok = false;
  const base = await start(async () => ok);
  expect((await fetch(base + "/ready")).status).toBe(503);
  ok = true;
  expect((await fetch(base + "/ready")).status).toBe(200);
});

it("non-GET methods return 405 with Allow: GET", async () => {
  const base = await start(async () => true);
  for (const path of ["/live", "/ready"]) {
    for (const method of ["POST", "PUT", "DELETE"]) {
      const res = await fetch(base + path, { method });
      expect(res.status).toBe(405);
      expect(res.headers.get("allow")).toBe("GET");
      await res.text();
    }
  }
});

it("unknown paths return 404 JSON", async () => {
  const base = await start(async () => true);
  const res = await fetch(base + "/nope");
  expect(res.status).toBe(404);
  expect(res.headers.get("content-type")).toMatch(/^application\/json/);
  await res.json();
});

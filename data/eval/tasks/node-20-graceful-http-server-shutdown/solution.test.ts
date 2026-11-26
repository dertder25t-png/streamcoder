import * as http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, expect, it } from "vitest";
import { attachGracefulShutdown } from "./solution";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const servers: http.Server[] = [];
const agents: http.Agent[] = [];

afterEach(() => {
  for (const a of agents.splice(0)) a.destroy();
  for (const s of servers.splice(0)) {
    s.closeAllConnections();
    s.close();
  }
});

async function start(handler: http.RequestListener): Promise<{ server: http.Server; port: number }> {
  const server = http.createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  return { server, port: (server.address() as AddressInfo).port };
}

function get(port: number, agent?: http.Agent): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: "/", agent: agent ?? false }, (res) => {
      const parts: Buffer[] = [];
      res.on("data", (c: Buffer) => parts.push(c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(parts).toString("utf8") }));
      res.on("error", reject);
      res.on("aborted", () => reject(new Error("aborted")));
    });
    req.on("error", reject);
    req.end();
  });
}

it("lets in-flight requests finish with their full response, and refuses new connections", async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => (release = r));
  let entered: () => void = () => {};
  const enteredP = new Promise<void>((r) => (entered = r));
  const { server, port } = await start((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.write("part1-");
    entered();
    void gate.then(() => res.end("part2"));
  });
  const shutdown = attachGracefulShutdown(server, { drainTimeoutMs: 5000 });

  const inflight = get(port);
  await enteredP;
  let finished = false;
  const sd = shutdown().then(() => {
    finished = true;
  });
  await sleep(80);
  expect(finished).toBe(false);
  await expect(get(port)).rejects.toBeDefined();
  release();
  const res = await inflight;
  expect(res.status).toBe(200);
  expect(res.body).toBe("part1-part2");
  await sd;
  expect(finished).toBe(true);
  expect(server.listening).toBe(false);
});

it("closes idle keep-alive connections promptly instead of waiting for socket timeouts", async () => {
  const { server, port } = await start((_req, res) => {
    res.end("ok");
  });
  const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
  agents.push(agent);
  const shutdown = attachGracefulShutdown(server, { drainTimeoutMs: 20000 });
  expect((await get(port, agent)).body).toBe("ok");
  expect((await get(port, agent)).body).toBe("ok");
  const t0 = Date.now();
  await shutdown();
  expect(Date.now() - t0).toBeLessThan(2000);
  expect(server.listening).toBe(false);
});

it("force-closes stalled sockets after drainTimeoutMs", async () => {
  let entered: () => void = () => {};
  const enteredP = new Promise<void>((r) => (entered = r));
  const { server, port } = await start((_req, res) => {
    res.writeHead(200);
    res.write("start");
    entered();
  });
  const shutdown = attachGracefulShutdown(server, { drainTimeoutMs: 300 });
  const stalled = get(port).catch(() => undefined);
  await enteredP;
  const t0 = Date.now();
  await shutdown();
  const elapsed = Date.now() - t0;
  expect(elapsed).toBeGreaterThanOrEqual(250);
  expect(elapsed).toBeLessThan(3000);
  expect(server.listening).toBe(false);
  await stalled;
});

it("returns the same promise for concurrent shutdown() calls", async () => {
  let entered: () => void = () => {};
  const enteredP = new Promise<void>((r) => (entered = r));
  const { server, port } = await start((_req, res) => {
    res.writeHead(200);
    res.write("x");
    entered();
  });
  const shutdown = attachGracefulShutdown(server, { drainTimeoutMs: 200 });
  const stalled = get(port).catch(() => undefined);
  await enteredP;
  const p1 = shutdown();
  const p2 = shutdown();
  expect(p2).toBe(p1);
  await Promise.all([p1, p2]);
  expect(server.listening).toBe(false);
  await stalled;
});

it("resolves quickly when there are no connections at all", async () => {
  const { server } = await start((_req, res) => {
    res.end("ok");
  });
  const shutdown = attachGracefulShutdown(server, { drainTimeoutMs: 20000 });
  const t0 = Date.now();
  await shutdown();
  expect(Date.now() - t0).toBeLessThan(1000);
});

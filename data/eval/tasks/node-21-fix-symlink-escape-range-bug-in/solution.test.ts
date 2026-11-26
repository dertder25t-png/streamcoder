import * as fs from "node:fs";
import * as http from "node:http";
import type { AddressInfo } from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createSafeFileServer } from "./solution";

const SECRET = "TOP-SECRET-OUTSIDE-ROOT";
const HELLO = "héllo wörld ✓\n";

let base: string;
let server: http.Server;
let port: number;

beforeEach(async () => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), "safe-file-server-"));
  const root = path.join(base, "root");
  fs.mkdirSync(path.join(root, "sub"), { recursive: true });
  fs.mkdirSync(path.join(base, "outsidedir"));
  fs.writeFileSync(path.join(base, "secret.txt"), SECRET);
  fs.writeFileSync(path.join(base, "outsidedir", "inner.txt"), SECRET);
  fs.writeFileSync(path.join(root, "hello.txt"), HELLO);
  fs.writeFileSync(path.join(root, "sub", "nested.txt"), "nested");
  fs.symlinkSync(path.join(base, "secret.txt"), path.join(root, "link.txt"));
  fs.symlinkSync(path.join(base, "outsidedir"), path.join(root, "linkdir"));
  server = createSafeFileServer(root);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  port = (server.address() as AddressInfo).port;
});

afterEach(() => {
  server.closeAllConnections();
  server.close();
  fs.rmSync(base, { recursive: true, force: true });
});

function request(method: string, urlPath: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: urlPath, method, agent: false }, (res) => {
      const parts: Buffer[] = [];
      res.on("data", (c: Buffer) => parts.push(c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(parts) }));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.end();
  });
}

it("serves files inside the root with an accurate Content-Length", async () => {
  const res = await request("GET", "/hello.txt");
  expect(res.status).toBe(200);
  expect(res.body.toString("utf8")).toBe(HELLO);
  expect(Number(res.headers["content-length"])).toBe(Buffer.byteLength(HELLO));
  const nested = await request("GET", "/sub/nested.txt");
  expect(nested.status).toBe(200);
  expect(nested.body.toString("utf8")).toBe("nested");
});

it("returns 403 for path traversal, including percent-encoded forms", async () => {
  for (const p of ["/../secret.txt", "/%2e%2e/secret.txt", "/%2E%2E/secret.txt", "/..%2fsecret.txt", "/%2e%2e%2fsecret.txt", "/sub/../../secret.txt", "/sub/%2e%2e/%2e%2e/secret.txt"]) {
    const res = await request("GET", p);
    expect(res.status, p).toBe(403);
    expect(res.body.toString("utf8")).not.toContain(SECRET);
  }
});

it("returns 403 for symlinks that point outside the root", async () => {
  for (const p of ["/link.txt", "/linkdir/inner.txt"]) {
    const res = await request("GET", p);
    expect(res.status, p).toBe(403);
    expect(res.body.toString("utf8")).not.toContain(SECRET);
  }
});

it("answers HEAD with the same headers as GET and no body", async () => {
  const get = await request("GET", "/hello.txt");
  const head = await request("HEAD", "/hello.txt");
  expect(head.status).toBe(200);
  expect(head.body.length).toBe(0);
  expect(Number(head.headers["content-length"])).toBe(Buffer.byteLength(HELLO));
  const strip = (h: http.IncomingHttpHeaders) => {
    const { date: _d, connection: _c, "keep-alive": _k, ...rest } = h;
    return rest;
  };
  expect(strip(head.headers)).toEqual(strip(get.headers));
});

it("returns 404 for missing files and directories and keeps serving afterwards", async () => {
  for (const p of ["/missing.txt", "/sub/nope.txt", "/sub", "/sub/", "/"]) {
    const res = await request("GET", p);
    expect(res.status, p).toBe(404);
  }
  const head = await request("HEAD", "/sub");
  expect(head.status).toBe(404);
  const ok = await request("GET", "/hello.txt");
  expect(ok.status).toBe(200);
  expect(ok.body.toString("utf8")).toBe(HELLO);
});

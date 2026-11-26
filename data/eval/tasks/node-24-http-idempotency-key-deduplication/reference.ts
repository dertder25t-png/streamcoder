import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void> | void;

interface Stored {
  status: number;
  headers: Record<string, string | number | string[]>;
  body: Buffer;
}
interface Entry {
  hash: string;
  expires: number;
  promise: Promise<Stored | null>;
}

export function createIdempotencyWrapper(opts: { ttlMs: number; now?: () => number }) {
  const now = opts.now ?? Date.now;
  const entries = new Map<string, Entry>();

  function send(res: ServerResponse, s: Stored): void {
    res.statusCode = s.status;
    for (const [k, v] of Object.entries(s.headers)) res.setHeader(k, v);
    res.end(s.body);
  }

  async function capture(handler: Handler, req: IncomingMessage, res: ServerResponse): Promise<Stored> {
    const chunks: Buffer[] = [];
    const push = (c: unknown) => {
      if (c === undefined || c === null || typeof c === "function") return;
      chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c)));
    };
    const r = res as any;
    r.write = (c: unknown, ...rest: unknown[]) => {
      push(c);
      const cb = rest.find((x) => typeof x === "function") as (() => void) | undefined;
      cb?.();
      return true;
    };
    r.end = (c?: unknown) => {
      push(c);
      return res;
    };
    r.writeHead = (status: number, a?: unknown, b?: unknown) => {
      res.statusCode = status;
      const h = (typeof a === "object" && a !== null ? a : b) as Record<string, string> | undefined;
      if (h) for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
      return res;
    };
    try {
      await handler(req, res);
    } finally {
      delete r.write;
      delete r.end;
      delete r.writeHead;
    }
    return {
      status: res.statusCode,
      headers: { ...(res.getHeaders() as Record<string, string | number | string[]>) },
      body: Buffer.concat(chunks),
    };
  }

  return (handler: Handler): ((req: IncomingMessage, res: ServerResponse) => Promise<void>) =>
    async (req, res) => {
      const raw = req.headers["idempotency-key"];
      const key = Array.isArray(raw) ? raw[0] : raw;
      if (!key) return void (await handler(req, res));
      const parts: Buffer[] = [];
      for await (const c of req) parts.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
      const hash = createHash("sha256").update(Buffer.concat(parts)).digest("hex");
      for (;;) {
        let e = entries.get(key);
        if (e && e.expires <= now()) {
          entries.delete(key);
          e = undefined;
        }
        if (!e) {
          let resolve!: (s: Stored | null) => void;
          const promise = new Promise<Stored | null>((r) => (resolve = r));
          entries.set(key, { hash, expires: now() + opts.ttlMs, promise });
          let stored: Stored;
          try {
            stored = await capture(handler, req, res);
          } catch (err) {
            entries.delete(key);
            resolve(null);
            throw err;
          }
          if (stored.status >= 500) {
            entries.delete(key);
            resolve(null);
          } else resolve(stored);
          send(res, stored);
          return;
        }
        if (e.hash !== hash) {
          res.statusCode = 409;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "Idempotency-Key reused with a different request body" }));
          return;
        }
        const stored = await e.promise;
        if (stored) {
          send(res, stored);
          return;
        }
      }
    };
}

import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

export function createConfigHandler(getConfig: () => unknown): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    let body: string;
    try {
      body = JSON.stringify(getConfig());
      if (body === undefined) body = "null";
    } catch {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "internal error" }));
      return;
    }
    const etag = `"${createHash("sha256").update(body).digest("hex")}"`;
    const header = req.headers["if-none-match"];
    const inm = Array.isArray(header) ? header.join(",") : header;
    let match = false;
    if (inm !== undefined) {
      const tags = inm.split(",").map((t) => t.trim());
      match = tags.some((t) => t === "*" || t === etag || t === `W/${etag}`);
    }
    if (match) {
      res.writeHead(304, { ETag: etag });
      res.end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
      ETag: etag,
    });
    res.end(body);
  };
}

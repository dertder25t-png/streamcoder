import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";

const TYPES: Record<string, string> = {
  ".txt": "text/plain; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json",
};

export function createSafeFileServer(rootDir: string): http.Server {
  return http.createServer((req, res) => {
    const send = (status: number, text: string) => {
      res.writeHead(status, { "Content-Type": "text/plain", "Content-Length": Buffer.byteLength(text) });
      res.end(req.method === "HEAD" ? undefined : text);
    };
    if (req.method !== "GET" && req.method !== "HEAD") return send(405, "Method Not Allowed");
    (async () => {
      let rel: string;
      try {
        rel = decodeURIComponent((req.url ?? "/").split("?")[0].split("#")[0]);
      } catch {
        return send(400, "Bad Request");
      }
      if (rel.includes("\0")) return send(400, "Bad Request");
      let root: string;
      try {
        root = await fs.promises.realpath(rootDir);
      } catch {
        return send(404, "Not Found");
      }
      const within = (p: string) => p === root || p.startsWith(root + path.sep);
      const target = path.resolve(root, "." + path.posix.sep + rel);
      if (!within(target)) return send(403, "Forbidden");
      let real: string;
      try {
        real = await fs.promises.realpath(target);
      } catch {
        return send(404, "Not Found");
      }
      if (!within(real)) return send(403, "Forbidden");
      let st: fs.Stats;
      try {
        st = await fs.promises.stat(real);
      } catch {
        return send(404, "Not Found");
      }
      if (!st.isFile()) return send(404, "Not Found");
      res.writeHead(200, {
        "Content-Type": TYPES[path.extname(real).toLowerCase()] ?? "application/octet-stream",
        "Content-Length": st.size,
      });
      if (req.method === "HEAD") return void res.end();
      const stream = fs.createReadStream(real);
      stream.on("error", () => res.destroy());
      stream.pipe(res);
    })().catch(() => {
      if (!res.headersSent) send(500, "Internal Server Error");
      else res.destroy();
    });
  });
}

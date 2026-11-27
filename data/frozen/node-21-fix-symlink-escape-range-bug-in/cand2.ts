import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";

export function createSafeFileServer(rootDir: string): http.Server {
  const root = path.resolve(rootDir);
  return http.createServer(async (req, res) => {
    const urlPath = (req.url ?? "/").split("?")[0];
    try {
      const filePath = path.resolve(path.join(root, decodeURIComponent(urlPath)));
      if (!filePath.startsWith(root)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      const stats = await fs.promises.stat(filePath);
      if (!stats.isFile()) {
        res.writeHead(404);
        res.end("Not Found");
        return;
      }
      if (req.method === "HEAD") {
        res.writeHead(200, { "Content-Type": "text/plain", "Content-Length": stats.size });
        res.end();
        return;
      }
      res.writeHead(200, { "Content-Type": "text/plain", "Content-Length": stats.size });
      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      res.writeHead(404);
      res.end("Not Found");
    }
  });
}

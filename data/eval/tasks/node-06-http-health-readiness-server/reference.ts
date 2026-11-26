import http from "node:http";

export function createHealthServer(checkReady: () => Promise<boolean>): http.Server {
  const send = (res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
      ...headers,
    });
    res.end(payload);
  };
  return http.createServer(async (req, res) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    if (path !== "/live" && path !== "/ready") return send(res, 404, { error: "not found" });
    if (req.method !== "GET") return send(res, 405, { error: "method not allowed" }, { Allow: "GET" });
    if (path === "/live") return send(res, 200, { status: "ok" });
    let ready = false;
    try {
      ready = (await checkReady()) === true;
    } catch {
      ready = false;
    }
    if (ready) send(res, 200, { status: "ok" });
    else send(res, 503, { status: "unavailable" });
  });
}

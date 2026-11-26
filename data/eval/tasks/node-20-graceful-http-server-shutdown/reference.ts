import type * as http from "node:http";
import type { Socket } from "node:net";

export function attachGracefulShutdown(
  server: http.Server,
  options: { drainTimeoutMs: number },
): () => Promise<void> {
  const sockets = new Set<Socket>();
  const busy = new Map<Socket, number>();
  const responses = new Set<http.ServerResponse>();
  let shuttingDown = false;
  let promise: Promise<void> | undefined;

  server.on("connection", (socket: Socket) => {
    sockets.add(socket);
    socket.on("close", () => {
      sockets.delete(socket);
      busy.delete(socket);
    });
  });

  server.prependListener("request", (req: http.IncomingMessage, res: http.ServerResponse) => {
    const socket = req.socket;
    busy.set(socket, (busy.get(socket) ?? 0) + 1);
    responses.add(res);
    if (shuttingDown) res.setHeader("Connection", "close");
    res.on("close", () => {
      responses.delete(res);
      const n = (busy.get(socket) ?? 1) - 1;
      busy.set(socket, n);
      if (shuttingDown && n === 0) socket.end();
    });
  });

  return function shutdown(): Promise<void> {
    if (promise) return promise;
    shuttingDown = true;
    promise = new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        for (const s of sockets) s.destroy();
      }, options.drainTimeoutMs);
      server.close(() => {
        clearTimeout(timer);
        resolve();
      });
      for (const res of responses) {
        if (!res.headersSent) res.setHeader("Connection", "close");
      }
      for (const s of sockets) {
        if ((busy.get(s) ?? 0) === 0) s.destroy();
      }
    });
    return promise;
  };
}

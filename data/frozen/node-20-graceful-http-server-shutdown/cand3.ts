import http from 'http';

export interface ShutdownOptions {
  drainTimeoutMs: number;
}

export function attachGracefulShutdown(server: http.Server, options: ShutdownOptions): () => Promise<void> {
  const { drainTimeoutMs } = options;
  let shutdownPromise: Promise<void> | null = null;
  let shutdownResolve: (() => void) | null = null;
  let shutdownReject: ((error: Error) => void) | null = null;

  const forceShutdown = () => {
    if (shutdownPromise) {
      shutdownReject?.(new Error('Server forced to shut down'));
    }
    server.close((err) => {
      if (err) {
        shutdownReject?.(err);
      } else {
        shutdownResolve?.();
      }
    });
  };

  server.on('request', (req, res) => {
    if (shutdownPromise) {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      res.end('Server is shutting down');
    }
  });

  server.on('connection', (socket) => {
    socket.setTimeout(drainTimeoutMs, () => {
      socket.destroy();
    });
  });

  server.on('close', () => {
    shutdownPromise?.resolve();
  });

  return () => {
    if (!shutdownPromise) {
      shutdownPromise = new Promise((resolve, reject) => {
        shutdownResolve = resolve;
        shutdownReject = reject;
        server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    return shutdownPromise;
  };
}

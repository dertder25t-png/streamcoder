import http from 'node:http';
import { promisify } from 'node:util';

interface ShutdownOptions {
  drainTimeoutMs: number;
}

export function attachGracefulShutdown(server: http.Server, options: ShutdownOptions): () => Promise<void> {
  const { drainTimeoutMs } = options;
  let shutdownPromise: Promise<void> | null = null;
  let shutdownResolve: () => void | null = null;
  let shutdownReject: (error: Error) => void | null = null;
  const destroySockets = promisify(server.destroy.bind(server));

  server.on('connection', (socket) => {
    socket.setTimeout(drainTimeoutMs);
    socket.on('timeout', () => {
      socket.end();
    });
  });

  return async () => {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    shutdownPromise = new Promise((resolve, reject) => {
      shutdownResolve = resolve;
      shutdownReject = reject;
    });

    server.close((error) => {
      if (error) {
        if (shutdownReject) {
          shutdownReject(error);
        }
      } else {
        if (shutdownResolve) {
          shutdownResolve();
        }
      }
    });

    try {
      await destroySockets();
    } catch (error) {
      if (shutdownReject) {
        shutdownReject(error);
      }
    } finally {
      shutdownResolve = null;
      shutdownReject = null;
    }

    return shutdownPromise;
  };
}

import { IncomingMessage, ServerResponse } from 'http';
import { createHash } from 'crypto';

interface IdempotencyWrapperOptions {
  ttlMs: number;
  now: () => number;
}

interface CacheEntry {
  status: number;
  headers: { [key: string]: string };
  body: string;
  expires: number;
}

const createIdempotencyWrapper = ({ ttlMs, now }: IdempotencyWrapperOptions) => {
  const cache = new Map<string, CacheEntry>();

  return async (handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>) => {
    return async (req: IncomingMessage, res: ServerResponse) => {
      const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
      if (!idempotencyKey) {
        return handler(req, res);
      }

      const requestBody = await readRequestBody(req);
      const bodyHash = createHash('sha256').update(requestBody).digest('hex');

      const cachedEntry = cache.get(idempotencyKey);
      if (cachedEntry && cachedEntry.body === bodyHash && now() < cachedEntry.expires) {
        res.writeHead(cachedEntry.status, cachedEntry.headers);
        res.end(cachedEntry.body);
        return;
      }

      try {
        const originalWriteHead = res.writeHead;
        const originalEnd = res.end;

        const response: { status: number; headers: { [key: string]: string }; body: string } = {
          status: 200,
          headers: {},
          body: '',
        };

        res.writeHead = (statusCode: number, headers?: { [key: string]: string }) => {
          response.status = statusCode;
          if (headers) {
            Object.assign(response.headers, headers);
          }
        };

        res.end = (chunk?: any, encoding?: BufferEncoding, callback?: () => void) => {
          if (typeof chunk === 'string') {
            response.body += chunk;
          }
          originalEnd.call(res, chunk, encoding, callback);
        };

        await handler(req, res);

        if (response.status >= 400) {
          cache.delete(idempotencyKey);
        } else {
          cache.set(idempotencyKey, {
            status: response.status,
            headers: response.headers,
            body: response.body,
            expires: now() + ttlMs,
          });
        }
      } catch (error) {
        cache.delete(idempotencyKey);
        throw error;
      }
    };
  };
};

const readRequestBody = async (req: IncomingMessage): Promise<string> => {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      resolve(body);
    });
    req.on('error', (err) => {
      reject(err);
    });
  });
};

export { createIdempotencyWrapper };

import { IncomingMessage, ServerResponse } from 'http';
import { createHash } from 'crypto';

type IdempotencyWrapperOptions = {
  ttlMs: number;
  now: () => number;
};

export function createIdempotencyWrapper({ ttlMs, now }: IdempotencyWrapperOptions) {
  const cache = new Map<string, { status: number; headers: { [key: string]: string }; body: string; expires: number }>();

  return async function handler(req: IncomingMessage, res: ServerResponse) {
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
    if (!idempotencyKey) {
      res.writeHead(400);
      res.end('Idempotency-Key header is required');
      return;
    }

    const requestBody = await readRequestBody(req);
    const requestHash = createHash('sha256').update(requestBody).digest('hex');

    if (cache.has(idempotencyKey)) {
      const cached = cache.get(idempotencyKey)!;
      if (cached.expires <= now()) {
        cache.delete(idempotencyKey);
      } else if (cached.body !== requestHash) {
        res.writeHead(409);
        res.end('Conflict: different request body for the same Idempotency-Key');
        return;
      } else {
        res.writeHead(cached.status, cached.headers);
        res.end(cached.body);
        return;
      }
    }

    try {
      const { status, headers, body } = await new Promise<{ status: number; headers: { [key: string]: string }; body: string }>((resolve, reject) => {
        let responseBody = '';
        res.on('data', (chunk) => responseBody += chunk);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.getHeaders(), body: responseBody }));
        res.on('error', (err) => reject(err));
      });

      cache.set(idempotencyKey, { status, headers, body, expires: now() + ttlMs });
      res.writeHead(status, headers);
      res.end(body);
    } catch (err) {
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  };
}

async function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => body += chunk);
    req.on('end', () => resolve(body));
    req.on('error', (err) => reject(err));
  });
}

import { performance } from 'node:perf_hooks';

interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  keyFn: (req: unknown) => string;
  now?: () => number;
}

interface RateLimiter {
  wrap(handler: (req: unknown, res: unknown) => void): (req: unknown, res: unknown) => void;
  size(): number;
}

function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { windowMs, maxRequests, keyFn, now = () => performance.now() } = options;
  const buckets: Record<string, { count: number; oldestRequest: number }> = {};

  function wrap(handler: (req: unknown, res: unknown) => void): (req: unknown, res: unknown) => void {
    return (req, res) => {
      const clientKey = keyFn(req);
      const currentTimestamp = now();

      // Evict expired buckets
      for (const key in buckets) {
        if (currentTimestamp - buckets[key].oldestRequest >= windowMs) {
          delete buckets[key];
        }
      }

      if (!buckets[clientKey]) {
        buckets[clientKey] = { count: 1, oldestRequest: currentTimestamp };
      } else {
        buckets[clientKey].count++;
        buckets[clientKey].oldestRequest = Math.min(
          buckets[clientKey].oldestRequest,
          currentTimestamp
        );
      }

      const remaining = Math.max(0, maxRequests - buckets[clientKey].count);
      const retryAfter = Math.ceil((buckets[clientKey].oldestRequest + windowMs - currentTimestamp) / 1000);
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('Retry-After', retryAfter.toString());

      if (buckets[clientKey].count > maxRequests) {
        res.statusCode = 429;
        res.end();
      } else {
        handler(req, res);
      }
    };
  }

  function size(): number {
    return Object.keys(buckets).length;
  }

  return { wrap, size };
}

export { createRateLimiter };

import { IncomingMessage, ServerResponse } from 'http';

interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  keyFn: (req: IncomingMessage) => string;
  now: () => number;
}

interface RateLimiter {
  wrap(handler: (req: IncomingMessage, res: ServerResponse) => void): (req: IncomingMessage, res: ServerResponse) => void;
  size(): number;
}

const createRateLimiter = ({ windowMs, maxRequests, keyFn, now }: RateLimiterOptions): RateLimiter => {
  const buckets = new Map<string, { count: number; oldest: number }>();

  const evictExpiredBuckets = () => {
    const nowMs = now();
    for (const [key, bucket] of buckets) {
      if (nowMs - bucket.oldest > windowMs) {
        buckets.delete(key);
      }
    }
  };

  const wrap = (handler: (req: IncomingMessage, res: ServerResponse) => void) => {
    return (req: IncomingMessage, res: ServerResponse) => {
      const key = keyFn(req);
      evictExpiredBuckets();

      const bucket = buckets.get(key) || { count: 0, oldest: now() };
      const nowMs = now();
      const timeSinceOldest = nowMs - bucket.oldest;

      if (timeSinceOldest > windowMs) {
        bucket.count = 1;
        bucket.oldest = nowMs;
      } else if (bucket.count >= maxRequests) {
        res.statusCode = 429;
        res.setHeader('X-RateLimit-Limit', maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('Retry-After', Math.ceil((bucket.oldest + windowMs - nowMs) / 1000).toString());
        res.end();
        return;
      } else {
        bucket.count++;
      }

      buckets.set(key, bucket);
      handler(req, res);
    };
  };

  const size = () => {
    evictExpiredBuckets();
    return buckets.size;
  };

  return { wrap, size };
};

export { createRateLimiter };

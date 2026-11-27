import { performance } from 'node:perf_hooks';

interface RateLimiterConfig {
  windowMs: number;
  maxRequests: number;
  keyFn: (req: any) => string;
  now: () => number;
}

class RateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly keyFn: (req: any) => string;
  private readonly now: () => number;
  private readonly buckets: Map<string, { count: number; oldest: number }>;

  constructor({ windowMs, maxRequests, keyFn, now }: RateLimiterConfig) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.keyFn = keyFn;
    this.now = now;
    this.buckets = new Map();
  }

  public wrap(handler: (req: any, res: any) => void) {
    return (req: any, res: any) => {
      const key = this.keyFn(req);
      const now = this.now();
      let bucket = this.buckets.get(key);

      if (bucket) {
        const elapsed = now - bucket.oldest;
        if (elapsed >= this.windowMs) {
          bucket.count = 1;
          bucket.oldest = now;
        } else {
          bucket.count++;
        }
      } else {
        bucket = { count: 1, oldest: now };
      }

      if (bucket.count > this.maxRequests) {
        res.setHeader('X-RateLimit-Limit', this.maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('Retry-After', Math.ceil((bucket.oldest + this.windowMs - now) / 1000).toString());
        res.statusCode = 429;
        res.end();
        return;
      }

      res.setHeader('X-RateLimit-Limit', this.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', (this.maxRequests - bucket.count).toString());
      if (bucket.count === 1) {
        res.setHeader('Retry-After', '0');
      } else {
        const elapsed = now - bucket.oldest;
        res.setHeader('Retry-After', Math.ceil((bucket.oldest + this.windowMs - now) / 1000).toString());
      }

      this.buckets.set(key, bucket);
      handler(req, res);
    };
  }

  public size() {
    this.evictExpiredBuckets();
    return this.buckets.size;
  }

  private evictExpiredBuckets() {
    const now = this.now();
    for (const [key, bucket] of this.buckets.entries()) {
      const elapsed = now - bucket.oldest;
      if (elapsed >= this.windowMs) {
        this.buckets.delete(key);
      }
    }
  }
}

export function createRateLimiter(config: RateLimiterConfig) {
  return new RateLimiter(config);
}

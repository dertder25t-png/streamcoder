import { performance } from 'node:perf_hooks';

interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  keyFn: (req: any) => string;
  now: () => number;
}

interface RateLimiter {
  wrap(handler: (req: any, res: any) => void): (req: any, res: any) => void;
  size(): number;
}

class ClientBucket {
  private windowMs: number;
  private maxRequests: number;
  private windowStart: number;
  private requests: number[];

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.windowStart = performance.now();
    this.requests = [];
  }

  request(): boolean {
    if (performance.now() - this.windowStart > this.windowMs) {
      this.windowStart = performance.now();
      this.requests = [];
    }
    if (this.requests.length >= this.maxRequests) {
      return false;
    }
    this.requests.push(performance.now());
    return true;
  }

  size(): number {
    return this.requests.length;
  }
}

function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { windowMs, maxRequests, keyFn, now } = options;
  const buckets = new Map<string, ClientBucket>();

  function wrap(handler: (req: any, res: any) => void): (req: any, res: any) => void {
    return (req: any, res: any) => {
      const key = keyFn(req);
      if (!buckets.has(key)) {
        buckets.set(key, new ClientBucket(windowMs, maxRequests));
      }
      const bucket = buckets.get(key)!;
      if (bucket.request()) {
        handler(req, res);
        res.setHeader('X-RateLimit-Limit', maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', (maxRequests - bucket.size()).toString());
      } else {
        res.statusCode = 429;
        res.setHeader('X-RateLimit-Limit', maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', '0');
        const oldestRequest = Math.min(...bucket.requests);
        const retryAfter = Math.ceil((oldestRequest + windowMs - now()) / 1000);
        res.setHeader('Retry-After', retryAfter.toString());
        res.end();
      }
      const expiredKeys = Array.from(buckets.keys()).filter(key => {
        const bucket = buckets.get(key)!;
        return performance.now() - bucket.windowStart > windowMs;
      });
      expiredKeys.forEach(key => buckets.delete(key));
    };
  }

  function size(): number {
    return buckets.size;
  }

  return { wrap, size };
}

export { createRateLimiter };

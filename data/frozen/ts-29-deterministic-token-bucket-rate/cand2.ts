import { ceil } from 'node:util';

interface TokenBucketOptions {
  capacity: number;
  refillPerSecond: number;
  now: () => number;
}

export function createTokenBucket(options: TokenBucketOptions) {
  const { capacity, refillPerSecond, now } = options;
  let lastRefillTime = now();
  let tokenCount = capacity;

  function refill() {
    const nowTime = now();
    if (lastRefillTime < nowTime) {
      const timeDelta = nowTime - lastRefillTime;
      const tokensToAdd = Math.floor((timeDelta * refillPerSecond) / 1000);
      tokenCount = Math.min(capacity, tokenCount + tokensToAdd);
      lastRefillTime = nowTime;
    }
  }

  function tryConsume(cost: number = 1): { allowed: boolean; remaining: number; retryAfterMs: number } {
    refill();
    if (cost > tokenCount) {
      const retryAfterMs = ceil((cost - tokenCount) / (refillPerSecond / 1000));
      return { allowed: false, remaining: tokenCount, retryAfterMs };
    } else {
      tokenCount -= cost;
      return { allowed: true, remaining: tokenCount, retryAfterMs: 0 };
    }
  }

  return { tryConsume };
}

import { ceil } from 'node:math';

interface TokenBucketOptions {
  capacity: number;
  refillPerSecond: number;
  now: () => number;
}

export function createTokenBucket(options: TokenBucketOptions) {
  let currentTokens = options.capacity;
  let lastRefillTime = options.now();

  function refill() {
    const now = options.now();
    const timeElapsed = now - lastRefillTime;
    const tokensToAdd = Math.floor((timeElapsed / 1000) * options.refillPerSecond);
    if (tokensToAdd > 0) {
      currentTokens = Math.min(currentTokens + tokensToAdd, options.capacity);
      lastRefillTime = now;
    }
  }

  function tryConsume(cost: number = 1): { allowed: boolean; remaining: number; retryAfterMs: number } {
    refill();
    if (currentTokens >= cost) {
      currentTokens -= cost;
      return { allowed: true, remaining: currentTokens, retryAfterMs: 0 };
    } else {
      return {
        allowed: false,
        remaining: currentTokens,
        retryAfterMs: ceil((cost - currentTokens) / options.refillPerSecond * 1000),
      };
    }
  }

  return {
    tryConsume,
  };
}

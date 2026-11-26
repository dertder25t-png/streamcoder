export function createTokenBucket(opts: {
  capacity: number;
  refillPerSecond: number;
  now: () => number;
}): { tryConsume(cost?: number): { allowed: boolean; remaining: number; retryAfterMs: number } } {
  const { capacity, refillPerSecond, now } = opts;
  let tokens = capacity;
  let last = now();
  return {
    tryConsume(cost = 1) {
      const t = now();
      const elapsed = Math.max(0, t - last);
      last = t;
      tokens = Math.min(capacity, tokens + (elapsed / 1000) * refillPerSecond);
      if (tokens >= cost) {
        tokens -= cost;
        return { allowed: true, remaining: tokens, retryAfterMs: 0 };
      }
      const retryAfterMs = refillPerSecond > 0 ? Math.ceil(((cost - tokens) / refillPerSecond) * 1000) : Infinity;
      return { allowed: false, remaining: tokens, retryAfterMs };
    },
  };
}

export function createRateLimiter<Req, Res extends { statusCode: number; setHeader(name: string, value: string): unknown; end(body?: string): unknown }>(opts: {
  windowMs: number;
  maxRequests: number;
  keyFn: (req: Req) => string;
  now: () => number;
}) {
  const hits = new Map<string, number[]>();
  const prune = (key: string, t: number) => {
    const list = (hits.get(key) ?? []).filter((x) => x > t - opts.windowMs);
    if (list.length) hits.set(key, list);
    else hits.delete(key);
    return list;
  };
  return {
    wrap(handler: (req: Req, res: Res) => void) {
      return (req: Req, res: Res): void => {
        const t = opts.now();
        const key = opts.keyFn(req);
        const list = prune(key, t);
        res.setHeader("X-RateLimit-Limit", String(opts.maxRequests));
        if (list.length >= opts.maxRequests) {
          res.setHeader("X-RateLimit-Remaining", "0");
          res.setHeader("Retry-After", String(Math.ceil((list[0] + opts.windowMs - t) / 1000)));
          res.statusCode = 429;
          res.end();
          return;
        }
        list.push(t);
        hits.set(key, list);
        res.setHeader("X-RateLimit-Remaining", String(opts.maxRequests - list.length));
        handler(req, res);
      };
    },
    size(): number {
      const t = opts.now();
      for (const k of [...hits.keys()]) prune(k, t);
      return hits.size;
    },
  };
}

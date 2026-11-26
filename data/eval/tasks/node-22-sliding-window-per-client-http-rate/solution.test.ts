import { expect, it } from "vitest";
import { createRateLimiter } from "./solution";

type Req = { id: string };
type Res = {
  statusCode: number;
  headers: Record<string, string>;
  ended: boolean;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
};

type Limiter = {
  wrap(handler: (req: Req, res: Res) => void): (req: Req, res: Res) => void;
  size(): number;
};

function mkRes(): Res {
  return {
    statusCode: 200,
    headers: {},
    ended: false,
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = String(value);
    },
    end() {
      this.ended = true;
    },
  };
}

function setup(windowMs = 10_000, maxRequests = 3) {
  let t = 1_000_000;
  const rl = (createRateLimiter as any)({ windowMs, maxRequests, keyFn: (r: Req) => r.id, now: () => t }) as Limiter;
  let handled = 0;
  const h = rl.wrap((_req: Req, res: Res) => {
    handled++;
    res.statusCode = 200;
    res.end("ok");
  });
  const hit = (id = "a") => {
    const res = mkRes();
    h({ id }, res);
    return res;
  };
  return { rl, hit, advance: (ms: number) => (t += ms), handled: () => handled };
}

it("allows maxRequests then returns 429 and does not call the handler", () => {
  const s = setup();
  for (let i = 0; i < 3; i++) expect(s.hit().statusCode).toBe(200);
  const blocked = s.hit();
  expect(blocked.statusCode).toBe(429);
  expect(blocked.ended).toBe(true);
  expect(s.handled()).toBe(3);
});

it("sets X-RateLimit-Limit and Remaining on allowed and blocked responses", () => {
  const s = setup();
  expect(s.hit().headers["x-ratelimit-remaining"]).toBe("2");
  expect(s.hit().headers["x-ratelimit-remaining"]).toBe("1");
  const third = s.hit();
  expect(third.headers["x-ratelimit-remaining"]).toBe("0");
  expect(third.headers["x-ratelimit-limit"]).toBe("3");
  const blocked = s.hit();
  expect(blocked.headers["x-ratelimit-limit"]).toBe("3");
  expect(blocked.headers["x-ratelimit-remaining"]).toBe("0");
});

it("Retry-After is whole seconds (rounded up) until the oldest counted request leaves the window", () => {
  const s = setup();
  s.hit();
  s.advance(3_000);
  s.hit();
  s.hit();
  s.advance(1_500);
  // oldest hit at +0, window 10s, now at +4.5s -> 5.5s left -> 6
  expect(s.hit().headers["retry-after"]).toBe("6");
});

it("window slides: capacity returns as the oldest requests expire", () => {
  const s = setup();
  s.hit();
  s.advance(4_000);
  s.hit();
  s.hit();
  expect(s.hit().statusCode).toBe(429);
  s.advance(6_000); // first hit is exactly windowMs old -> expired
  expect(s.hit().statusCode).toBe(200);
  expect(s.hit().statusCode).toBe(429); // the two at +4s still count
});

it("blocked requests are not counted against the client", () => {
  const s = setup();
  for (let i = 0; i < 3; i++) s.hit();
  for (let i = 0; i < 5; i++) s.hit();
  s.advance(10_000);
  expect(s.hit().statusCode).toBe(200);
});

it("tracks clients independently", () => {
  const s = setup(10_000, 1);
  expect(s.hit("a").statusCode).toBe(200);
  expect(s.hit("a").statusCode).toBe(429);
  expect(s.hit("b").statusCode).toBe(200);
});

it("size() counts tracked clients and returns to 0 once all windows expire", () => {
  const s = setup();
  expect(s.rl.size()).toBe(0);
  s.hit("a");
  s.advance(5_000);
  s.hit("b");
  s.hit("c");
  expect(s.rl.size()).toBe(3);
  s.advance(5_000);
  expect(s.rl.size()).toBe(2);
  s.advance(5_000);
  expect(s.rl.size()).toBe(0);
});

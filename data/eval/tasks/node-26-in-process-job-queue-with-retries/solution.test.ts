import { expect, it } from "vitest";
import { createJobQueue } from "./solution";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// The processor / dead-letter callback may receive either the raw payload or a job object
// wrapping it; tests use string payloads and normalise.
const pl = (x: any): string => (x !== null && typeof x === "object" && "payload" in x ? x.payload : x);

it("retries a failing job up to maxRetries times then dead-letters it with the last error", async () => {
  const attempts: Record<string, number> = {};
  const dead: { p: string; err: unknown }[] = [];
  const errs: Error[] = [];
  const q = createJobQueue({
    concurrency: 2,
    maxRetries: 2,
    processor: async (job: any) => {
      const p = pl(job);
      attempts[p] = (attempts[p] ?? 0) + 1;
      if (p === "bad") {
        const e = new Error("fail-" + attempts[p]);
        errs.push(e);
        throw e;
      }
    },
    onDeadLetter: (job: any, err: unknown) => {
      dead.push({ p: pl(job), err });
    },
  });
  q.enqueue("bad");
  q.enqueue("good");
  await q.drain();
  expect(attempts["bad"]).toBe(3); // 1 initial + 2 retries
  expect(attempts["good"]).toBe(1);
  expect(dead).toHaveLength(1);
  expect(dead[0].p).toBe("bad");
  expect(dead[0].err).toBe(errs[2]);
  expect(await q.stats()).toEqual({ queued: 0, active: 0, completed: 1, deadLettered: 1 });
});

it("tracks retries per job independently", async () => {
  const attempts: Record<string, number> = {};
  const dead: string[] = [];
  const q = createJobQueue({
    concurrency: 1,
    maxRetries: 2,
    processor: async (job: any) => {
      const p = pl(job);
      attempts[p] = (attempts[p] ?? 0) + 1;
      if (p === "always") throw new Error("x");
      if (p === "once" && attempts[p] === 1) throw new Error("x");
      if (p === "twice" && attempts[p] <= 2) throw new Error("x");
    },
    onDeadLetter: (job: any) => {
      dead.push(pl(job));
    },
  });
  for (const p of ["always", "once", "twice", "fine"]) q.enqueue(p);
  await q.drain();
  expect(attempts).toEqual({ always: 3, once: 2, twice: 3, fine: 1 });
  expect(dead).toEqual(["always"]);
  expect(await q.stats()).toEqual({ queued: 0, active: 0, completed: 3, deadLettered: 1 });
});

it("runs up to `concurrency` jobs in parallel and no more", async () => {
  let running = 0;
  let peak = 0;
  const q = createJobQueue({
    concurrency: 3,
    maxRetries: 0,
    processor: async () => {
      running++;
      peak = Math.max(peak, running);
      await sleep(20);
      running--;
    },
    onDeadLetter: () => {},
  });
  for (let i = 0; i < 9; i++) q.enqueue("j" + i);
  await q.drain();
  expect(peak).toBe(3);
  expect((await q.stats()).completed).toBe(9);
});

it("drain waits for in-flight and retried jobs, and resolves immediately when idle", async () => {
  await createJobQueue({ concurrency: 1, maxRetries: 1, processor: async () => {}, onDeadLetter: () => {} }).drain();
  const done: string[] = [];
  let first = true;
  const q = createJobQueue({
    concurrency: 2,
    maxRetries: 3,
    processor: async (job: any) => {
      const p = pl(job);
      await sleep(10);
      if (p === "flaky" && first) {
        first = false;
        throw new Error("once");
      }
      done.push(p);
    },
    onDeadLetter: () => {},
  });
  q.enqueue("flaky");
  q.enqueue("b");
  q.enqueue("c");
  q.enqueue("d");
  await q.drain();
  expect(done.sort()).toEqual(["b", "c", "d", "flaky"]);
  expect(await q.stats()).toEqual({ queued: 0, active: 0, completed: 4, deadLettered: 0 });
});

it("stats are never negative and always account for every enqueued job", async () => {
  const total = 8;
  const q = createJobQueue({
    concurrency: 2,
    maxRetries: 1,
    processor: async (job: any) => {
      await sleep(3);
      if (pl(job).startsWith("bad")) throw new Error("x");
    },
    onDeadLetter: () => {},
  });
  const check = async () => {
    const s = await q.stats();
    for (const v of Object.values(s) as number[]) expect(v).toBeGreaterThanOrEqual(0);
    expect(s.active).toBeLessThanOrEqual(2);
    expect(s.queued + s.active + s.completed + s.deadLettered).toBe(total);
  };
  for (let i = 0; i < total; i++) q.enqueue(i % 3 === 0 ? "bad" + i : "ok" + i);
  const timer = setInterval(() => void check(), 1);
  await q.drain();
  clearInterval(timer);
  await check();
  expect(await q.stats()).toEqual({ queued: 0, active: 0, completed: 5, deadLettered: 3 });
});

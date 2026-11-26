import { expect, it } from "vitest";
import { runTaskPool } from "./solution";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

it("never exceeds the concurrency limit and keeps input order", async () => {
  let active = 0;
  let peak = 0;
  const delays = [30, 5, 20, 1, 15, 2, 25, 3];
  const out = await runTaskPool(delays, 3, async (ms: number, i: number) => {
    active++;
    peak = Math.max(peak, active);
    await sleep(ms);
    active--;
    return `r${i}`;
  });
  expect(peak).toBe(3);
  expect(out).toEqual(delays.map((_, i) => `r${i}`));
});

it("resolves [] for empty input", async () => {
  expect(await runTaskPool([], 2, async () => 1)).toEqual([]);
});

it("throws RangeError synchronously for invalid concurrency", () => {
  for (const c of [0, -1, 1.5, NaN]) {
    expect(() => runTaskPool([1], c, async (x: number) => x)).toThrow(RangeError);
  }
});

it("stops starting new items after a rejection", async () => {
  const started: number[] = [];
  const boom = new Error("boom");
  const p = runTaskPool([0, 1, 2, 3, 4, 5], 2, async (x: number) => {
    started.push(x);
    await sleep(10);
    if (x === 1) throw boom;
    return x;
  });
  await expect(p).rejects.toBe(boom);
  await sleep(50);
  expect(started.length).toBeLessThanOrEqual(3);
  expect(started).not.toContain(5);
});

it("rejects with the abort reason and starts nothing new", async () => {
  const ctrl = new AbortController();
  const started: number[] = [];
  const p = runTaskPool([0, 1, 2, 3, 4], 1, async (x: number) => {
    started.push(x);
    await sleep(20);
    return x;
  }, { signal: ctrl.signal });
  setTimeout(() => ctrl.abort(new Error("stop")), 5);
  await expect(p).rejects.toThrow("stop");
  await sleep(60);
  expect(started).toEqual([0]);
});

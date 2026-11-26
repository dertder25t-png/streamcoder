import { expect, it } from "vitest";
import { movingWindowMean } from "./solution";

it("computes the mean of each contiguous window", () => {
  expect(movingWindowMean([1, 2, 3, 4, 5], 2)).toEqual([1.5, 2.5, 3.5, 4.5]);
  expect(movingWindowMean([2, 4, 6, 8], 4)).toEqual([5]);
  expect(movingWindowMean([7, 9], 1)).toEqual([7, 9]);
  expect(movingWindowMean([10, 0, -10], 3)).toEqual([0]);
});

it("returns [] when there are fewer values than the window", () => {
  expect(movingWindowMean([], 3)).toEqual([]);
  expect(movingWindowMean([1, 2], 3)).toEqual([]);
});

it("throws RangeError when windowSize is not a positive integer", () => {
  const vals = [1, 2, 3, 4, 5, 6];
  for (const bad of [0, -1, 1.5, NaN, Infinity, -Infinity]) {
    expect(() => movingWindowMean(vals, bad), String(bad)).toThrow(RangeError);
  }
});

it("does not mutate its input", () => {
  const vals = [1, 2, 3, 4];
  movingWindowMean(vals, 2);
  expect(vals).toEqual([1, 2, 3, 4]);
});

it("gives accurate means on a large array of identical numbers", () => {
  const n = 100_000;
  for (const x of [0.1, 0.7, 123456.789]) {
    const out = movingWindowMean(new Array<number>(n).fill(x), 7);
    expect(out).toHaveLength(n - 6);
    let worst = 0;
    for (const m of out) worst = Math.max(worst, Math.abs(m - x) / x);
    expect(worst).toBeLessThan(1e-14);
  }
});


it("reads each input element a constant number of times (O(n))", () => {
  const n = 2000;
  const base = Array.from({ length: n }, (_, i) => i);
  let reads = 0;
  const counted = new Proxy(base, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && /^\d+$/.test(prop)) reads++;
      return Reflect.get(target, prop, receiver);
    },
  }) as number[];
  const out = movingWindowMean(counted, 500);
  expect(out).toHaveLength(n - 499);
  expect(out[0]).toBeCloseTo(249.5, 9);
  expect(reads).toBeLessThan(20 * n);
});

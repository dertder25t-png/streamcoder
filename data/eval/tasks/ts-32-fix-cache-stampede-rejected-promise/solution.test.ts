import { expect, it, vi } from "vitest";
import { memoizeAsync } from "./solution";

function deferred<V>() {
  let resolve!: (v: V) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<V>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

it("concurrent calls for the same key share one pending promise and one fn call", async () => {
  const d = deferred<number>();
  const fn = vi.fn((_key: string) => d.promise);
  const memo = memoizeAsync(fn, { ttlMs: 1000, maxEntries: 10, now: () => 0 });
  const p1 = memo("a");
  const p2 = memo("a");
  expect(p2).toBe(p1);
  expect(fn).toHaveBeenCalledTimes(1);
  d.resolve(7);
  expect(await p1).toBe(7);
  expect(await memo("a")).toBe(7);
  expect(fn).toHaveBeenCalledTimes(1);
});

it("different keys are cached independently", async () => {
  const fn = vi.fn(async (key: string) => key.toUpperCase());
  const memo = memoizeAsync(fn, { ttlMs: 1000, maxEntries: 10, now: () => 0 });
  expect(await memo("a")).toBe("A");
  expect(await memo("b")).toBe("B");
  expect(fn).toHaveBeenCalledTimes(2);
});

it("a rejection is evicted so the next call retries", async () => {
  let n = 0;
  const fn = vi.fn(async (_key: string) => {
    n++;
    if (n === 1) throw new Error("boom");
    return "ok";
  });
  const memo = memoizeAsync(fn, { ttlMs: 1000, maxEntries: 10, now: () => 0 });
  const p1 = memo("k");
  const p2 = memo("k");
  expect(p2).toBe(p1);
  await expect(p1).rejects.toThrow("boom");
  expect(await memo("k")).toBe("ok");
  expect(fn).toHaveBeenCalledTimes(2);
  expect(await memo("k")).toBe("ok");
  expect(fn).toHaveBeenCalledTimes(2);
});

it("resolved values expire once now() - start >= ttlMs", async () => {
  let t = 0;
  let n = 0;
  const fn = vi.fn(async (_key: string) => ++n);
  const memo = memoizeAsync(fn, { ttlMs: 100, maxEntries: 10, now: () => t });
  expect(await memo("a")).toBe(1);
  t = 99;
  expect(await memo("a")).toBe(1);
  t = 100;
  expect(await memo("a")).toBe(2);
  expect(fn).toHaveBeenCalledTimes(2);
  t = 150;
  expect(await memo("a")).toBe(2);
  t = 200;
  expect(await memo("a")).toBe(3);
});

it("evicts the oldest inserted entry when maxEntries is exceeded", async () => {
  const fn = vi.fn(async (key: string) => key);
  const memo = memoizeAsync(fn, { ttlMs: 1000, maxEntries: 2, now: () => 0 });
  await memo("a");
  await memo("b");
  await memo("c");
  expect(fn).toHaveBeenCalledTimes(3);
  await memo("b");
  await memo("c");
  expect(fn).toHaveBeenCalledTimes(3);
  await memo("a");
  expect(fn).toHaveBeenCalledTimes(4);
});

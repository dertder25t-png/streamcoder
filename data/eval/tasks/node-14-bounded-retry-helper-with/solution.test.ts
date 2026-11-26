import { expect, it } from "vitest";
import { retryWithBackoff } from "./solution";

const tick = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function recorder() {
  const delays: number[] = [];
  const sleep = async (ms: number): Promise<void> => {
    delays.push(ms);
  };
  return { delays, sleep };
}

it("resolves immediately on first success without sleeping", async () => {
  const { delays, sleep } = recorder();
  let calls = 0;
  const out = await retryWithBackoff(async () => {
    calls++;
    return "ok";
  }, { maxAttempts: 3, baseDelayMs: 100, sleep });
  expect(out).toBe("ok");
  expect(calls).toBe(1);
  expect(delays).toEqual([]);
});

it("doubles the delay between failures and resolves on a later success", async () => {
  const { delays, sleep } = recorder();
  let calls = 0;
  const out = await retryWithBackoff(async () => {
    calls++;
    if (calls < 4) throw new Error("fail " + calls);
    return 42;
  }, { maxAttempts: 5, baseDelayMs: 100, sleep });
  expect(out).toBe(42);
  expect(calls).toBe(4);
  expect(delays).toEqual([100, 200, 400]);
});

it("re-throws the last error once maxAttempts is exhausted", async () => {
  const { delays, sleep } = recorder();
  let calls = 0;
  await expect(
    retryWithBackoff(async (): Promise<number> => {
      calls++;
      throw new Error("e" + calls);
    }, { maxAttempts: 3, baseDelayMs: 10, sleep }),
  ).rejects.toThrow("e3");
  expect(calls).toBe(3);
  expect(delays).toEqual([10, 20]);
});

it("makes a single attempt when maxAttempts is 1", async () => {
  const { delays, sleep } = recorder();
  let calls = 0;
  await expect(
    retryWithBackoff(async (): Promise<number> => {
      calls++;
      throw new Error("once");
    }, { maxAttempts: 1, baseDelayMs: 10, sleep }),
  ).rejects.toThrow("once");
  expect(calls).toBe(1);
  expect(delays).toEqual([]);
});

it("stops immediately and re-throws when shouldRetry returns false", async () => {
  const { delays, sleep } = recorder();
  let calls = 0;
  const fatal = new Error("fatal");
  const seen: unknown[] = [];
  await expect(
    retryWithBackoff(async (): Promise<number> => {
      calls++;
      if (calls === 1) throw new Error("transient");
      throw fatal;
    }, {
      maxAttempts: 10,
      baseDelayMs: 5,
      sleep,
      shouldRetry: (err: unknown): boolean => {
        seen.push(err);
        return (err as Error).message !== "fatal";
      },
    }),
  ).rejects.toBe(fatal);
  expect(calls).toBe(2);
  expect(delays).toEqual([5]);
  expect(seen).toHaveLength(2);
});

it("makes no attempt when the signal is already aborted", async () => {
  const { delays, sleep } = recorder();
  const ctrl = new AbortController();
  ctrl.abort();
  let calls = 0;
  await expect(
    retryWithBackoff(async () => {
      calls++;
      return 1;
    }, { maxAttempts: 3, baseDelayMs: 10, sleep, signal: ctrl.signal }),
  ).rejects.toBeDefined();
  expect(calls).toBe(0);
  expect(delays).toEqual([]);
});

it("aborts during backoff sleep without further attempts", async () => {
  const ctrl = new AbortController();
  let calls = 0;
  const sleep = (_ms: number): Promise<void> => tick(30);
  const p = retryWithBackoff(async (): Promise<number> => {
    calls++;
    throw new Error("nope");
  }, { maxAttempts: 5, baseDelayMs: 10, sleep, signal: ctrl.signal });
  const assertion = expect(p).rejects.toBeDefined();
  setTimeout(() => ctrl.abort(), 5);
  await assertion;
  await tick(60);
  expect(calls).toBe(1);
});

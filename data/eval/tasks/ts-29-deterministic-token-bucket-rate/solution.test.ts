import { expect, it } from "vitest";
import { createTokenBucket } from "./solution";

function setup(capacity: number, refillPerSecond: number) {
  let t = 1_000_000;
  const bucket = createTokenBucket({ capacity, refillPerSecond, now: (): number => t });
  return { bucket, advance: (ms: number): void => { t += ms; }, set: (v: number): void => { t = v; } };
}

it("starts full at capacity", () => {
  const { bucket } = setup(5, 1);
  const r = bucket.tryConsume(5);
  expect(r.allowed).toBe(true);
  expect(r.remaining).toBe(0);
});

it("defaults cost to 1", () => {
  const { bucket } = setup(3, 1);
  expect(bucket.tryConsume().remaining).toBe(2);
  expect(bucket.tryConsume().remaining).toBe(1);
});

it("refills continuously from elapsed time", () => {
  const { bucket, advance } = setup(10, 2);
  expect(bucket.tryConsume(10).allowed).toBe(true);
  advance(1000);
  const r = bucket.tryConsume(2);
  expect(r.allowed).toBe(true);
  expect(r.remaining).toBe(0);
  advance(500);
  expect(bucket.tryConsume(1).allowed).toBe(true);
});

it("never exceeds capacity", () => {
  const { bucket, advance } = setup(4, 10);
  bucket.tryConsume(1);
  advance(60_000);
  expect(bucket.tryConsume(4).allowed).toBe(true);
  expect(bucket.tryConsume(1).allowed).toBe(false);
});

it("does not deduct tokens when insufficient and reports retryAfterMs rounded up", () => {
  const { bucket, advance } = setup(5, 3);
  expect(bucket.tryConsume(5).allowed).toBe(true);
  const denied = bucket.tryConsume(2);
  expect(denied.allowed).toBe(false);
  expect(denied.retryAfterMs).toBe(667); // 2 / 3 per sec = 666.67ms
  // denied attempt took nothing: after 1000ms we hold exactly 3 tokens
  advance(1000);
  expect(bucket.tryConsume(3).allowed).toBe(true);
  expect(bucket.tryConsume(1).allowed).toBe(false);
});

it("retryAfterMs accounts for partially refilled tokens", () => {
  const { bucket, advance } = setup(10, 4);
  bucket.tryConsume(10);
  advance(500); // 2 tokens
  const denied = bucket.tryConsume(5);
  expect(denied.allowed).toBe(false);
  expect(denied.retryAfterMs).toBe(750); // 3 more tokens at 4/s
});

it("survives the clock moving backwards", () => {
  const { bucket, advance, set } = setup(5, 1);
  expect(bucket.tryConsume(3).allowed).toBe(true);
  set(0);
  const r = bucket.tryConsume(1);
  expect(Number.isFinite(r.remaining)).toBe(true);
  expect(r.remaining).toBeGreaterThanOrEqual(0);
  expect(r.allowed).toBe(true);
  const r2 = bucket.tryConsume(5);
  expect(Number.isFinite(r2.remaining)).toBe(true);
  expect(r2.remaining).toBeGreaterThanOrEqual(0);
  expect(Number.isFinite(r2.retryAfterMs)).toBe(true);
  expect(r2.retryAfterMs).toBeGreaterThanOrEqual(0);
  advance(10);
  const r3 = bucket.tryConsume(1);
  expect(Number.isNaN(r3.remaining)).toBe(false);
  expect(r3.remaining).toBeGreaterThanOrEqual(0);
});

import { EventEmitter } from "node:events";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { waitForEventWithTimeout } from "./solution";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

it("resolves with the payload, clears the timer and removes listeners", async () => {
  const em = new EventEmitter();
  const p = waitForEventWithTimeout(em, "ready", 1000);
  expect(em.listenerCount("ready")).toBeGreaterThan(0);
  em.emit("ready", { id: 7 });
  await expect(p).resolves.toEqual({ id: 7 });
  expect(vi.getTimerCount()).toBe(0);
  expect(em.listenerCount("ready")).toBe(0);
  expect(em.listenerCount("error")).toBe(0);
});

it("leaves pre-existing listeners of the caller alone", async () => {
  const em = new EventEmitter();
  const mine = (): void => {};
  em.on("ready", mine);
  em.on("error", mine);
  const p = waitForEventWithTimeout(em, "ready", 1000);
  em.emit("ready", 1);
  await p;
  expect(em.listeners("ready")).toEqual([mine]);
  expect(em.listeners("error")).toEqual([mine]);
});

it("does not resolve again or throw on later emissions", async () => {
  const em = new EventEmitter();
  const p = waitForEventWithTimeout(em, "ready", 1000);
  em.emit("ready", "first");
  await expect(p).resolves.toBe("first");
  expect(() => em.emit("ready", "second")).not.toThrow();
  vi.advanceTimersByTime(5000);
});

it("rejects with a timeout Error and removes both listeners", async () => {
  const em = new EventEmitter();
  const p = waitForEventWithTimeout(em, "ready", 500);
  const assertion = expect(p).rejects.toBeInstanceOf(Error);
  vi.advanceTimersByTime(499);
  expect(em.listenerCount("ready")).toBeGreaterThan(0);
  vi.advanceTimersByTime(1);
  await assertion;
  expect(em.listenerCount("ready")).toBe(0);
  expect(em.listenerCount("error")).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});

it("rejects immediately with an emitted error and leaves no listeners or timers", async () => {
  const em = new EventEmitter();
  const p = waitForEventWithTimeout(em, "ready", 1000);
  const boom = new Error("boom");
  const assertion = expect(p).rejects.toBe(boom);
  em.emit("error", boom);
  await assertion;
  expect(em.listenerCount("ready")).toBe(0);
  expect(em.listenerCount("error")).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});

it("an event arriving after an error is ignored", async () => {
  const em = new EventEmitter();
  const p = waitForEventWithTimeout(em, "ready", 1000);
  const boom = new Error("early");
  const assertion = expect(p).rejects.toBe(boom);
  em.emit("error", boom);
  em.emit("ready", "late");
  await assertion;
});

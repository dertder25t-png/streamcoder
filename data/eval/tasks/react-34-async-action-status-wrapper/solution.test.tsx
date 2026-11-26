// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { useAsyncAction } from "./solution";

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

it("isLoading is true while pending and false after success", async () => {
  const d = deferred<number>();
  const { result } = renderHook(() => useAsyncAction<number>(() => d.promise));
  expect(result.current.isLoading).toBe(false);
  expect(result.current.error).toBeNull();
  let p!: Promise<void>;
  act(() => {
    p = result.current.execute();
  });
  expect(result.current.isLoading).toBe(true);
  await act(async () => {
    d.resolve(1);
    await p;
  });
  expect(result.current.isLoading).toBe(false);
  expect(result.current.error).toBeNull();
});

it("captures a rejection into error without throwing", async () => {
  const boom = new Error("boom");
  const { result } = renderHook(() => useAsyncAction<void>(() => Promise.reject(boom)));
  await act(async () => {
    await result.current.execute();
  });
  expect(result.current.error).toBe(boom);
  expect(result.current.isLoading).toBe(false);
});

it("clears the previous error when executing again", async () => {
  const first = deferred<void>();
  const second = deferred<void>();
  const queue = [first, second];
  const { result } = renderHook(() => useAsyncAction<void>(() => queue.shift()!.promise));
  let p!: Promise<void>;
  act(() => {
    p = result.current.execute();
  });
  await act(async () => {
    first.reject(new Error("first"));
    await p;
  });
  expect(result.current.error?.message).toBe("first");
  act(() => {
    p = result.current.execute();
  });
  expect(result.current.isLoading).toBe(true);
  expect(result.current.error).toBeNull();
  await act(async () => {
    second.resolve();
    await p;
  });
  expect(result.current.isLoading).toBe(false);
  expect(result.current.error).toBeNull();
});

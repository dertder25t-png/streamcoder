// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { useLocalStorageState } from "./solution";

beforeEach(() => window.localStorage.clear());

it("falls back to initialValue when nothing is stored", () => {
  const { result } = renderHook(() => useLocalStorageState("k", { n: 1 }));
  expect(result.current[0]).toEqual({ n: 1 });
});

it("reads an existing JSON value from localStorage", () => {
  window.localStorage.setItem("k", JSON.stringify({ n: 42 }));
  const { result } = renderHook(() => useLocalStorageState("k", { n: 1 }));
  expect(result.current[0]).toEqual({ n: 42 });
});

it("writes to localStorage when the setter runs (value and updater)", () => {
  const { result } = renderHook(() => useLocalStorageState<number>("count", 0));
  act(() => result.current[1](5));
  expect(result.current[0]).toBe(5);
  expect(JSON.parse(window.localStorage.getItem("count")!)).toBe(5);
  act(() => result.current[1]((p: number) => p + 1));
  expect(result.current[0]).toBe(6);
  expect(JSON.parse(window.localStorage.getItem("count")!)).toBe(6);
});

it("updates from a storage event for the same key and ignores other keys", () => {
  const { result } = renderHook(() => useLocalStorageState<number>("count", 0));
  act(() => {
    window.localStorage.setItem("count", JSON.stringify(9));
    window.dispatchEvent(new StorageEvent("storage", { key: "count", newValue: JSON.stringify(9) }));
  });
  expect(result.current[0]).toBe(9);
  act(() => {
    window.localStorage.setItem("other", JSON.stringify(100));
    window.dispatchEvent(new StorageEvent("storage", { key: "other", newValue: JSON.stringify(100) }));
  });
  expect(result.current[0]).toBe(9);
});

it("stops listening after unmount", () => {
  const { result, unmount } = renderHook(() => useLocalStorageState<number>("count", 0));
  unmount();
  window.localStorage.setItem("count", JSON.stringify(7));
  window.dispatchEvent(new StorageEvent("storage", { key: "count", newValue: JSON.stringify(7) }));
  expect(result.current[0]).toBe(0);
});

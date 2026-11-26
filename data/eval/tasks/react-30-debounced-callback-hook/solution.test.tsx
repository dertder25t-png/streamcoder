// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useDebouncedCallback } from "./solution";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("fires once, with the last arguments, after the delay", () => {
  const cb = vi.fn();
  const { result } = renderHook(() => useDebouncedCallback(cb, 300));
  act(() => {
    result.current("a");
    vi.advanceTimersByTime(100);
    result.current("ab");
    vi.advanceTimersByTime(100);
    result.current("abc");
  });
  act(() => vi.advanceTimersByTime(299));
  expect(cb).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(cb).toHaveBeenCalledTimes(1);
  expect(cb).toHaveBeenCalledWith("abc");
});

it("uses the newest callback when it changes between calls", () => {
  const first = vi.fn();
  const second = vi.fn();
  const { result, rerender } = renderHook(({ cb }) => useDebouncedCallback(cb, 200), {
    initialProps: { cb: first },
  });
  act(() => result.current());
  rerender({ cb: second });
  act(() => result.current());
  act(() => vi.advanceTimersByTime(200));
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
});

it("never fires after unmount", () => {
  const cb = vi.fn();
  const { result, unmount } = renderHook(() => useDebouncedCallback(cb, 200));
  act(() => result.current());
  unmount();
  vi.advanceTimersByTime(1000);
  expect(cb).not.toHaveBeenCalled();
});

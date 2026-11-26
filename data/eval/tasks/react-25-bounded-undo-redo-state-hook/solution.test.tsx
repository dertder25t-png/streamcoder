// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { useUndoableState } from "./solution";

it("set accepts values and functional updaters; undo/redo walk history", () => {
  const { result } = renderHook(() => useUndoableState<number>(0));
  expect(result.current.canUndo).toBe(false);
  expect(result.current.canRedo).toBe(false);
  act(() => result.current.set(1));
  act(() => result.current.set((p: number) => p + 1));
  expect(result.current.state).toBe(2);
  act(() => result.current.undo());
  expect(result.current.state).toBe(1);
  expect(result.current.canRedo).toBe(true);
  act(() => result.current.undo());
  expect(result.current.state).toBe(0);
  expect(result.current.canUndo).toBe(false);
  act(() => result.current.redo());
  act(() => result.current.redo());
  expect(result.current.state).toBe(2);
  expect(result.current.canRedo).toBe(false);
});

it("setting after an undo discards the redo branch", () => {
  const { result } = renderHook(() => useUndoableState<number>(0));
  act(() => result.current.set(1));
  act(() => result.current.set(2));
  act(() => result.current.undo());
  act(() => result.current.set(10));
  expect(result.current.canRedo).toBe(false);
  act(() => result.current.redo());
  expect(result.current.state).toBe(10);
});

it("skips history when the next value is Object.is-equal", () => {
  const obj = { a: 1 };
  const { result } = renderHook(() => useUndoableState<{ a: number }>(obj));
  act(() => result.current.set(obj));
  expect(result.current.canUndo).toBe(false);
  act(() => result.current.set((p: { a: number }) => p));
  expect(result.current.canUndo).toBe(false);
  act(() => result.current.set({ a: 1 }));
  expect(result.current.canUndo).toBe(true);
});

it("bounds past history to maxHistory, dropping the oldest", () => {
  const { result } = renderHook(() => useUndoableState<number>(0, 3));
  for (let i = 1; i <= 6; i++) act(() => result.current.set(i));
  const seen: number[] = [];
  while (result.current.canUndo) {
    act(() => result.current.undo());
    seen.push(result.current.state);
  }
  expect(seen).toEqual([5, 4, 3]);
});

it("reset returns to the initial value", () => {
  const { result } = renderHook(() => useUndoableState<number>(7));
  act(() => result.current.set(8));
  act(() => result.current.reset());
  expect(result.current.state).toBe(7);
});

it("keeps stable identities for undo, redo, set and reset", () => {
  const { result } = renderHook(() => useUndoableState<number>(0));
  const first = { ...result.current };
  act(() => result.current.set(1));
  act(() => result.current.undo());
  act(() => result.current.redo());
  expect(result.current.set).toBe(first.set);
  expect(result.current.undo).toBe(first.undo);
  expect(result.current.redo).toBe(first.redo);
  expect(result.current.reset).toBe(first.reset);
});

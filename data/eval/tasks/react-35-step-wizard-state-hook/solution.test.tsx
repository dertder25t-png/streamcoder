// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { useWizard } from "./solution";

it("starts at step 0 and moves forward and back", () => {
  const { result } = renderHook(() => useWizard(3));
  expect(result.current.step).toBe(0);
  act(() => result.current.next());
  expect(result.current.step).toBe(1);
  act(() => result.current.prev());
  expect(result.current.step).toBe(0);
});

it("clamps next at the last step and prev at the first", () => {
  const { result } = renderHook(() => useWizard(3));
  act(() => result.current.prev());
  expect(result.current.step).toBe(0);
  act(() => {
    result.current.next();
    result.current.next();
    result.current.next();
    result.current.next();
  });
  expect(result.current.step).toBe(2);
});

it("clamps goTo into 0..totalSteps-1", () => {
  const { result } = renderHook(() => useWizard(4));
  act(() => result.current.goTo(2));
  expect(result.current.step).toBe(2);
  act(() => result.current.goTo(99));
  expect(result.current.step).toBe(3);
  act(() => result.current.goTo(-5));
  expect(result.current.step).toBe(0);
});

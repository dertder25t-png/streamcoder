// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ToastList } from "./solution";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

it("auto-dismisses after the default duration, or the toast's own duration", () => {
  const onDismiss = vi.fn();
  render(
    <ToastList
      toasts={[
        { id: "a", message: "Saved" },
        { id: "b", message: "Quick", durationMs: 500 },
      ]}
      onDismiss={onDismiss}
      defaultDurationMs={2000}
    />,
  );
  advance(499);
  expect(onDismiss).not.toHaveBeenCalled();
  advance(1);
  expect(onDismiss).toHaveBeenCalledTimes(1);
  expect(onDismiss).toHaveBeenLastCalledWith("b");
  advance(1499);
  expect(onDismiss).toHaveBeenCalledTimes(1);
  advance(1);
  expect(onDismiss).toHaveBeenCalledTimes(2);
  expect(onDismiss).toHaveBeenLastCalledWith("a");
  advance(10000);
  expect(onDismiss).toHaveBeenCalledTimes(2);
});

it("uses 4000 ms when no default duration is given", () => {
  const onDismiss = vi.fn();
  render(<ToastList toasts={[{ id: "a", message: "Hi" }]} onDismiss={onDismiss} />);
  advance(3999);
  expect(onDismiss).not.toHaveBeenCalled();
  advance(1);
  expect(onDismiss).toHaveBeenCalledWith("a");
});

it("close button dismisses that toast", () => {
  const onDismiss = vi.fn();
  render(
    <ToastList
      toasts={[
        { id: "a", message: "One", durationMs: 0 },
        { id: "b", message: "Two", durationMs: 0 },
      ]}
      onDismiss={onDismiss}
    />,
  );
  const buttons = screen.getAllByRole("button");
  expect(buttons).toHaveLength(2);
  fireEvent.click(buttons[1]);
  expect(onDismiss).toHaveBeenCalledTimes(1);
  expect(onDismiss).toHaveBeenCalledWith("b");
});

it("hovering pauses the countdown and leaving resumes it", () => {
  const onDismiss = vi.fn();
  render(<ToastList toasts={[{ id: "a", message: "Hover me" }]} onDismiss={onDismiss} defaultDurationMs={1000} />);
  const button = screen.getByRole("button");
  advance(600);
  fireEvent.mouseEnter(button);
  advance(10000);
  expect(onDismiss).not.toHaveBeenCalled();
  fireEvent.mouseLeave(button);
  advance(1);
  expect(onDismiss).not.toHaveBeenCalled();
  advance(1000);
  expect(onDismiss).toHaveBeenCalledTimes(1);
  expect(onDismiss).toHaveBeenCalledWith("a");
});

it("durationMs 0 persists until dismissed manually", () => {
  const onDismiss = vi.fn();
  render(<ToastList toasts={[{ id: "a", message: "Sticky", durationMs: 0 }]} onDismiss={onDismiss} defaultDurationMs={100} />);
  advance(100000);
  expect(onDismiss).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button"));
  expect(onDismiss).toHaveBeenCalledTimes(1);
  expect(onDismiss).toHaveBeenCalledWith("a");
});

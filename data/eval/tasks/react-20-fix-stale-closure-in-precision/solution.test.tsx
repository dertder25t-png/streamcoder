// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PrecisionTimer } from "./solution";

let clock = 0;
const now = () => clock;

beforeEach(() => {
  clock = 5_000;
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// Move the injected clock by `ms`, then let any interval fire a few times.
// The clock jumps further than the interval period, so tick-counting gives wrong answers.
const pass = (ms: number) => {
  clock += ms;
  act(() => void vi.advanceTimersByTime(250));
};
const toggle = () => screen.getByRole("button", { name: /^(start|pause|resume)$/i });
const display = () => screen.getByRole("timer").textContent;
const lapItems = () => screen.queryAllByRole("listitem").map((n) => n.textContent ?? "");
const click = (el: HTMLElement) => fireEvent.click(el);

it("shows 00:00.0 before starting", () => {
  render(<PrecisionTimer now={now} />);
  expect(display()).toBe("00:00.0");
});

it("computes elapsed time from now() deltas, not tick counts", () => {
  render(<PrecisionTimer now={now} />);
  click(toggle());
  pass(1500);
  expect(display()).toBe("00:01.5");
  pass(63_700);
  expect(display()).toBe("01:05.2");
});

it("preserves total time across pause/resume cycles", () => {
  render(<PrecisionTimer now={now} />);
  click(toggle());
  pass(2000);
  expect(display()).toBe("00:02.0");
  click(toggle()); // pause
  clock += 5000;
  act(() => void vi.advanceTimersByTime(1000));
  expect(display()).toBe("00:02.0");
  click(toggle()); // resume
  pass(1000);
  expect(display()).toBe("00:03.0");
  click(toggle()); // pause again
  clock += 9000;
  click(toggle()); // resume again
  pass(500);
  expect(display()).toBe("00:03.5");
});

it("Lap records total elapsed and the split since the previous lap", () => {
  render(<PrecisionTimer now={now} />);
  click(toggle());
  pass(1500);
  click(screen.getByRole("button", { name: /^lap$/i }));
  pass(2300);
  click(screen.getByRole("button", { name: /^lap$/i }));
  pass(1000);
  click(screen.getByRole("button", { name: /^lap$/i }));
  const items = lapItems();
  expect(items).toHaveLength(3);
  expect(items[0]).toContain("00:01.5");
  expect(items[1]).toContain("00:03.8");
  expect(items[1]).toContain("00:02.3");
  expect(items[2]).toContain("00:04.8");
  expect(items[2]).toContain("00:01.0");
});

it("laps keep correct splits across a pause", () => {
  render(<PrecisionTimer now={now} />);
  click(toggle());
  pass(1000);
  click(screen.getByRole("button", { name: /^lap$/i }));
  click(toggle());
  clock += 4000;
  click(toggle());
  pass(2000);
  click(screen.getByRole("button", { name: /^lap$/i }));
  const items = lapItems();
  expect(items[1]).toContain("00:03.0");
  expect(items[1]).toContain("00:02.0");
});

it("Reset stops the timer, zeroes the display and clears laps", () => {
  render(<PrecisionTimer now={now} />);
  click(toggle());
  pass(1200);
  click(screen.getByRole("button", { name: /^lap$/i }));
  expect(lapItems()).toHaveLength(1);
  click(screen.getByRole("button", { name: /^reset$/i }));
  expect(display()).toBe("00:00.0");
  expect(lapItems()).toHaveLength(0);
  pass(3000);
  expect(display()).toBe("00:00.0");
  expect(toggle().textContent).toMatch(/start/i);
  click(toggle());
  pass(700);
  expect(display()).toBe("00:00.7");
});

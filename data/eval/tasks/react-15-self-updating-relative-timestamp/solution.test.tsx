// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TimeAgoLabel } from "./solution";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const T0 = 1_700_000_000_000;
const text = (c: HTMLElement) => c.querySelector("time")?.textContent;

it("renders a semantic <time> element", () => {
  const { container } = render(<TimeAgoLabel timestampMs={T0} now={() => T0} />);
  expect(container.querySelector("time")).not.toBeNull();
});

it("formats the boundaries", () => {
  const cases: Array<[number, string]> = [
    [0, "just now"],
    [59, "just now"],
    [59.9, "just now"],
    [60, "1m ago"],
    [119, "1m ago"],
    [119.9, "1m ago"],
    [120, "2m ago"],
    [3599, "59m ago"],
    [3599.9, "59m ago"],
    [3600, "1h ago"],
    [7199, "1h ago"],
    [7200, "2h ago"],
    [86400, "24h ago"],
  ];
  for (const [seconds, expected] of cases) {
    const { container, unmount } = render(
      <TimeAgoLabel timestampMs={T0 - seconds * 1000} now={() => T0} />,
    );
    expect(text(container), `${seconds}s`).toBe(expected);
    unmount();
  }
});

it("advances its text on its own as time passes", () => {
  let current = T0;
  const { container } = render(<TimeAgoLabel timestampMs={T0 - 50_000} now={() => current} />);
  expect(text(container)).toBe("just now");
  current += 30_000;
  act(() => void vi.advanceTimersByTime(30_000));
  expect(text(container)).toBe("1m ago");
  current += 59 * 60_000;
  act(() => void vi.advanceTimersByTime(59 * 60_000));
  expect(text(container)).toBe("1h ago");
});

it("clears its interval when unmounted", () => {
  const { unmount } = render(<TimeAgoLabel timestampMs={T0} now={() => T0} />);
  expect(vi.getTimerCount()).toBeGreaterThan(0);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

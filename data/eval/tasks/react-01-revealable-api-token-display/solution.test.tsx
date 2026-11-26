// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RevealableToken } from "./solution";

let writeText: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("shows a message and no buttons for an empty token", () => {
  render(<RevealableToken token="" />);
  expect(screen.getByText("No token provided")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Show" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
});

it("masks by default and toggles Show/Hide", () => {
  render(<RevealableToken token="abc123" />);
  expect(screen.getByText("••••••")).toBeTruthy();
  expect(screen.queryByText("abc123")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Show" }));
  expect(screen.getByText("abc123")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Hide" }));
  expect(screen.getByText("••••••")).toBeTruthy();
});

it("copies, shows Copied for 2000 ms, then hides it", async () => {
  render(<RevealableToken token="secret" />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
  });
  expect(writeText).toHaveBeenCalledWith("secret");
  expect(screen.getByText("Copied")).toBeTruthy();
  act(() => vi.advanceTimersByTime(1999));
  expect(screen.queryByText("Copied")).toBeTruthy();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByText("Copied")).toBeNull();
});

it("clears the Copied timer on unmount", async () => {
  const { unmount } = render(<RevealableToken token="secret" />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
  });
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it("re-masks when the token prop changes", () => {
  const { rerender } = render(<RevealableToken token="first" />);
  fireEvent.click(screen.getByRole("button", { name: "Show" }));
  expect(screen.getByText("first")).toBeTruthy();
  rerender(<RevealableToken token="second!" />);
  expect(screen.queryByText("second!")).toBeNull();
  expect(screen.getByText("•••••••")).toBeTruthy();
});

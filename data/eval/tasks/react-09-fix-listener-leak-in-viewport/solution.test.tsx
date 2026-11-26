// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ViewportBadge } from "./solution";

function setWidth(w: number) {
  Object.defineProperty(window, "innerWidth", { value: w, configurable: true, writable: true });
}
function resizeTo(w: number) {
  setWidth(w);
  act(() => {
    window.dispatchEvent(new Event("resize"));
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("classifies the initial width on first render", () => {
  for (const [w, label] of [
    [500, "mobile"],
    [639, "mobile"],
    [640, "tablet"],
    [1023, "tablet"],
    [1024, "desktop"],
    [1600, "desktop"],
  ] as const) {
    setWidth(w);
    const { unmount } = render(<ViewportBadge />);
    expect(screen.getByText(label)).toBeTruthy();
    unmount();
  }
});

it("updates on resize, including boundary widths", () => {
  setWidth(1200);
  render(<ViewportBadge />);
  expect(screen.getByText("desktop")).toBeTruthy();
  resizeTo(1023);
  expect(screen.getByText("tablet")).toBeTruthy();
  resizeTo(640);
  expect(screen.getByText("tablet")).toBeTruthy();
  resizeTo(639);
  expect(screen.getByText("mobile")).toBeTruthy();
  resizeTo(1024);
  expect(screen.getByText("desktop")).toBeTruthy();
});

it("registers one resize listener across re-renders and removes it on unmount", () => {
  const add = vi.spyOn(window, "addEventListener");
  const remove = vi.spyOn(window, "removeEventListener");
  setWidth(500);
  const { unmount } = render(<ViewportBadge />);
  resizeTo(800);
  resizeTo(1200);
  resizeTo(300);
  const added = add.mock.calls.filter((c) => c[0] === "resize");
  expect(added.length).toBe(1);
  unmount();
  const removed = remove.mock.calls.filter((c) => c[0] === "resize");
  expect(removed.length).toBe(1);
  expect(removed[0][1]).toBe(added[0][1]);
});

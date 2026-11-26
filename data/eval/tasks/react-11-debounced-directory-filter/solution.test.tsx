// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FilterableDirectory } from "./solution";

const entries = [
  { id: "1", name: "Zelda Quill", department: "Engineering" },
  { id: "2", name: "Marco Bell", department: "Marketing" },
  { id: "3", name: "Priya Stone", department: "Finance" },
];

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const input = () => document.querySelector("input") as HTMLInputElement;
const type = (v: string) => fireEvent.change(input(), { target: { value: v } });
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const has = (name: string) => screen.queryByText(name) !== null;

it("updates the input immediately but filters only after the delay", () => {
  render(<FilterableDirectory entries={entries} delayMs={300} />);
  expect(has("Zelda Quill") && has("Marco Bell") && has("Priya Stone")).toBe(true);
  type("zel");
  expect(input().value).toBe("zel");
  expect(has("Marco Bell")).toBe(true);
  advance(299);
  expect(has("Marco Bell")).toBe(true);
  advance(1);
  expect(has("Marco Bell")).toBe(false);
  expect(has("Zelda Quill")).toBe(true);
});

it("restarts the delay on each keystroke", () => {
  render(<FilterableDirectory entries={entries} delayMs={300} />);
  type("m");
  advance(200);
  type("ma");
  advance(200);
  expect(has("Zelda Quill")).toBe(true);
  advance(100);
  expect(has("Zelda Quill")).toBe(false);
  expect(has("Marco Bell")).toBe(true);
});

it("defaults delayMs to 250", () => {
  render(<FilterableDirectory entries={entries} />);
  type("priya");
  advance(249);
  expect(has("Zelda Quill")).toBe(true);
  advance(1);
  expect(has("Zelda Quill")).toBe(false);
});

it("matches name or department case-insensitively", () => {
  render(<FilterableDirectory entries={entries} delayMs={100} />);
  type("FINANCE");
  advance(100);
  expect(has("Priya Stone")).toBe(true);
  expect(has("Zelda Quill")).toBe(false);
  type("BELL");
  advance(100);
  expect(has("Marco Bell")).toBe(true);
  expect(has("Priya Stone")).toBe(false);
});

it("shows 'No matching people' when nothing matches", () => {
  render(<FilterableDirectory entries={entries} delayMs={100} />);
  expect(screen.queryByText("No matching people")).toBeNull();
  type("zzzz");
  advance(100);
  expect(screen.getByText("No matching people")).toBeTruthy();
});

it("Clear resets immediately and cancels the pending debounce", () => {
  render(<FilterableDirectory entries={entries} delayMs={300} />);
  type("zel");
  advance(300);
  expect(has("Marco Bell")).toBe(false);
  type("marco");
  advance(100);
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  expect(input().value).toBe("");
  expect(has("Zelda Quill") && has("Marco Bell") && has("Priya Stone")).toBe(true);
  advance(1000);
  expect(input().value).toBe("");
  expect(has("Zelda Quill") && has("Priya Stone")).toBe(true);
});

it("clears the pending timer on unmount", () => {
  const { unmount } = render(<FilterableDirectory entries={entries} delayMs={300} />);
  type("zel");
  expect(vi.getTimerCount()).toBeGreaterThan(0);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

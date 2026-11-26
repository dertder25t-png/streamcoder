// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AsyncAutocomplete } from "./solution";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

type Call = { query: string; signal: AbortSignal; resolve: (v: string[]) => void };

function setup() {
  const calls: Call[] = [];
  const fetchSuggestions = (query: string, signal: AbortSignal): Promise<string[]> =>
    new Promise<string[]>((resolve) => {
      calls.push({ query, signal, resolve });
    });
  const onSelect = vi.fn();
  const utils = render(<AsyncAutocomplete fetchSuggestions={fetchSuggestions} onSelect={onSelect} />);
  return { calls, onSelect, ...utils };
}

const input = () => screen.getByRole("combobox") as HTMLInputElement;
const flush = () => act(async () => void (await vi.advanceTimersByTimeAsync(1000)));
const type = async (value: string) => {
  fireEvent.change(input(), { target: { value } });
  await flush();
};
const key = (k: string) => fireEvent.keyDown(input(), { key: k });
const optionTexts = () => screen.queryAllByRole("option").map((o) => o.textContent);
const activeIndex = () => {
  const opts = screen.queryAllByRole("option");
  return opts.findIndex(
    (o) =>
      o.getAttribute("aria-selected") === "true" ||
      (o.id !== "" && input().getAttribute("aria-activedescendant") === o.id),
  );
};
const respond = (call: Call, values: string[]) => act(async () => call.resolve(values));

it("discards a stale slow response that resolves after a newer one", async () => {
  const { calls } = setup();
  await type("a");
  await type("ab");
  expect(calls.map((c) => c.query)).toEqual(["a", "ab"]);
  await respond(calls[1], ["ab-one", "ab-two"]);
  expect(optionTexts()).toEqual(["ab-one", "ab-two"]);
  await respond(calls[0], ["a-one", "a-two", "a-three"]);
  expect(optionTexts()).toEqual(["ab-one", "ab-two"]);
});

it("passes an AbortSignal and aborts the previous request when the query changes", async () => {
  const { calls } = setup();
  await type("a");
  expect(calls[0].signal).toBeInstanceOf(AbortSignal);
  expect(calls[0].signal.aborted).toBe(false);
  await type("ab");
  expect(calls[0].signal.aborted).toBe(true);
  expect(calls[1].signal.aborted).toBe(false);
});

it("aborts the in-flight request on unmount", async () => {
  const { calls, unmount } = setup();
  await type("a");
  unmount();
  expect(calls[0].signal.aborted).toBe(true);
});

it("arrow keys move the active option and wrap in both directions", async () => {
  const { calls } = setup();
  await type("x");
  await respond(calls[0], ["one", "two", "three"]);
  expect(screen.getByRole("listbox")).not.toBeNull();
  key("ArrowDown");
  const a = activeIndex();
  expect(a).toBeGreaterThanOrEqual(0);
  key("ArrowDown");
  expect(activeIndex()).toBe((a + 1) % 3);
  key("ArrowDown");
  expect(activeIndex()).toBe((a + 2) % 3);
  key("ArrowDown");
  expect(activeIndex()).toBe(a);
  key("ArrowUp");
  expect(activeIndex()).toBe((a + 2) % 3);
  key("ArrowUp");
  expect(activeIndex()).toBe((a + 1) % 3);
});

it("ArrowUp from the top wraps to the last option", async () => {
  const { calls, onSelect } = setup();
  await type("x");
  await respond(calls[0], ["one", "two", "three"]);
  key("ArrowDown");
  while (activeIndex() !== 0) key("ArrowDown");
  key("ArrowUp");
  expect(activeIndex()).toBe(2);
  key("Enter");
  expect(onSelect).toHaveBeenCalledWith("three");
});

it("Enter selects the active option", async () => {
  const { calls, onSelect } = setup();
  await type("x");
  await respond(calls[0], ["one", "two", "three"]);
  key("ArrowDown");
  while (activeIndex() !== 1) key("ArrowDown");
  key("Enter");
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(onSelect).toHaveBeenCalledWith("two");
});

it("Escape closes the listbox", async () => {
  const { calls } = setup();
  await type("x");
  await respond(calls[0], ["one", "two"]);
  expect(screen.queryByRole("listbox")).not.toBeNull();
  key("Escape");
  expect(screen.queryByRole("listbox")).toBeNull();
});

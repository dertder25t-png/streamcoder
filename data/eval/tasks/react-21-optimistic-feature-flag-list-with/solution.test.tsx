// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { OptimisticFeatureFlags } from "./solution";

afterEach(cleanup);

const flags = [
  { id: "a", label: "Dark mode", enabled: false },
  { id: "b", label: "Beta search", enabled: true },
  { id: "c", label: "New sidebar", enabled: false },
];

function deferred() {
  let resolve!: () => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(onToggle: (id: string, next: boolean) => Promise<void>) {
  const utils = render(<OptimisticFeatureFlags flags={flags} onToggle={onToggle} />);
  const switches = () =>
    Array.from(utils.container.querySelectorAll<HTMLInputElement>('[role="switch"],[role="checkbox"],input[type="checkbox"]'));
  const isOn = (i: number) => {
    const el = switches()[i];
    return el.getAttribute("aria-checked") === "true" || (el.getAttribute("aria-checked") === null && el.checked);
  };
  const hasError = () =>
    utils.container.querySelector('[role="alert"]') !== null ||
    /error|fail|unable|couldn|could not|try again|revert|network down/i.test(utils.container.textContent ?? "");
  return { ...utils, switches, isOn, hasError };
}

it("reflects the initial state", () => {
  const { isOn, switches } = setup(() => Promise.resolve());
  expect(switches()).toHaveLength(3);
  expect([0, 1, 2].map(isOn)).toEqual([false, true, false]);
});

it("updates synchronously on click, before onToggle resolves, and calls onToggle(id, next)", async () => {
  const d = deferred();
  const onToggle = vi.fn((_id: string, _next: boolean): Promise<void> => d.promise);
  const { switches, isOn } = setup(onToggle);
  fireEvent.click(switches()[0]);
  expect(isOn(0)).toBe(true);
  expect(onToggle).toHaveBeenCalledWith("a", true);
  await act(async () => d.resolve());
  expect(isOn(0)).toBe(true);
  fireEvent.click(switches()[1]);
  expect(isOn(1)).toBe(false);
  expect(onToggle).toHaveBeenLastCalledWith("b", false);
});

it("rolls back only the failed flag and shows an error, leaving concurrent toggles alone", async () => {
  const da = deferred();
  const dc = deferred();
  const onToggle = vi.fn((id: string, _next: boolean): Promise<void> => (id === "a" ? da.promise : dc.promise));
  const { switches, isOn, hasError } = setup(onToggle);
  expect(hasError()).toBe(false);
  fireEvent.click(switches()[0]);
  fireEvent.click(switches()[2]);
  expect(isOn(0)).toBe(true);
  expect(isOn(2)).toBe(true);
  await act(async () => da.reject(new Error("Network down")));
  expect(isOn(0)).toBe(false);
  expect(isOn(2)).toBe(true);
  expect(isOn(1)).toBe(true);
  expect(hasError()).toBe(true);
  await act(async () => dc.resolve());
  expect(isOn(2)).toBe(true);
  expect(isOn(0)).toBe(false);
});

it("a failed flag reverts to its confirmed state, not the initial one", async () => {
  const d1 = deferred();
  const d2 = deferred();
  const queue = [d1, d2];
  const onToggle = vi.fn((_id: string, _next: boolean): Promise<void> => queue.shift()!.promise);
  const { switches, isOn } = setup(onToggle);
  fireEvent.click(switches()[0]);
  await act(async () => d1.resolve());
  expect(isOn(0)).toBe(true);
  fireEvent.click(switches()[0]);
  expect(isOn(0)).toBe(false);
  await act(async () => d2.reject(new Error("fail")));
  expect(isOn(0)).toBe(true);
});

it("blocks overlapping requests on the same flag but allows other flags concurrently", async () => {
  const da = deferred();
  const onToggle = vi.fn((_id: string, _next: boolean): Promise<void> => da.promise);
  const { switches, isOn } = setup(onToggle);
  fireEvent.click(switches()[0]);
  fireEvent.click(switches()[0]);
  fireEvent.click(switches()[0]);
  expect(onToggle).toHaveBeenCalledTimes(1);
  expect(isOn(0)).toBe(true);
  fireEvent.click(switches()[2]);
  expect(onToggle).toHaveBeenCalledTimes(2);
  expect(onToggle).toHaveBeenLastCalledWith("c", true);
  await act(async () => da.resolve());
  fireEvent.click(switches()[0]);
  expect(onToggle).toHaveBeenCalledTimes(3);
  expect(onToggle).toHaveBeenLastCalledWith("a", false);
});

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RegionCityPicker } from "./solution";

afterEach(cleanup);

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const regionSel = () => screen.getByLabelText("Region") as HTMLSelectElement;
const citySel = () => screen.getByLabelText("City") as HTMLSelectElement;
const cityNames = () => Array.from(citySel().options).map((o) => o.text).filter((t) => t !== "Select a city");
const pick = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });

it("ignores an earlier region's response that resolves after a later one", async () => {
  const a = deferred<string[]>();
  const b = deferred<string[]>();
  const fetchCities = vi.fn((r: string) => (r === "A" ? a.promise : b.promise));
  render(<RegionCityPicker regions={["A", "B"]} fetchCities={fetchCities} onChange={() => {}} />);
  pick(regionSel(), "A");
  pick(regionSel(), "B");
  await act(async () => {
    b.resolve(["b1", "b2"]);
  });
  await act(async () => {
    a.resolve(["a1"]);
  });
  expect(cityNames()).toEqual(["b1", "b2"]);
  expect(citySel().disabled).toBe(false);
});

it("clears the chosen city immediately on region switch and disables the city select while loading", async () => {
  const a = deferred<string[]>();
  const b = deferred<string[]>();
  const fetchCities = vi.fn((r: string) => (r === "A" ? a.promise : b.promise));
  render(<RegionCityPicker regions={["A", "B"]} fetchCities={fetchCities} onChange={() => {}} />);
  pick(regionSel(), "A");
  expect(citySel().disabled).toBe(true);
  await act(async () => {
    a.resolve(["a1", "a2"]);
  });
  expect(citySel().disabled).toBe(false);
  pick(citySel(), "a2");
  expect(citySel().value).toBe("a2");
  pick(regionSel(), "B");
  expect(citySel().value).toBe("");
  expect(citySel().disabled).toBe(true);
  await act(async () => {
    b.resolve(["b1"]);
  });
  expect(citySel().disabled).toBe(false);
  expect(citySel().value).toBe("");
  expect(cityNames()).toEqual(["b1"]);
});

it("shows Retry on rejection and retries only the current region", async () => {
  const first = deferred<string[]>();
  const second = deferred<string[]>();
  const calls: string[] = [];
  const fetchCities = vi.fn((r: string) => {
    calls.push(r);
    if (calls.length === 1) return first.promise;
    return second.promise;
  });
  render(<RegionCityPicker regions={["A", "B"]} fetchCities={fetchCities} onChange={() => {}} />);
  pick(regionSel(), "B");
  await act(async () => {
    first.reject(new Error("net"));
  });
  const retry = screen.getByRole("button", { name: /retry/i });
  fireEvent.click(retry);
  expect(calls).toEqual(["B", "B"]);
  await act(async () => {
    second.resolve(["b1"]);
  });
  expect(cityNames()).toEqual(["b1"]);
  expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
});

it("a stale rejection from an earlier region does not show an error", async () => {
  const a = deferred<string[]>();
  const b = deferred<string[]>();
  const fetchCities = (r: string) => (r === "A" ? a.promise : b.promise);
  render(<RegionCityPicker regions={["A", "B"]} fetchCities={fetchCities} onChange={() => {}} />);
  pick(regionSel(), "A");
  pick(regionSel(), "B");
  await act(async () => {
    b.resolve(["b1"]);
  });
  await act(async () => {
    a.reject(new Error("late"));
  });
  expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  expect(cityNames()).toEqual(["b1"]);
});

import { expect, expectTypeOf, it } from "vitest";
import { collapseStatusLog } from "./solution";

it("returns [] for empty input", () => {
  expect(collapseStatusLog([])).toEqual([]);
});

it("merges consecutive identical statuses", () => {
  const r = collapseStatusLog([
    { timestamp: 10, status: "up" },
    { timestamp: 20, status: "up" },
    { timestamp: 35, status: "up" },
    { timestamp: 40, status: "down" },
  ]);
  expect(r).toEqual([
    { status: "up", start: 10, end: 35, count: 3 },
    { status: "down", start: 40, end: 40, count: 1 },
  ]);
});

it("keeps non-consecutive repeats separate and in order", () => {
  const r = collapseStatusLog([
    { timestamp: 1, status: "up" },
    { timestamp: 2, status: "down" },
    { timestamp: 3, status: "up" },
  ]);
  expect(r.map((x) => x.status)).toEqual(["up", "down", "up"]);
  expect(r.map((x) => x.count)).toEqual([1, 1, 1]);
});

it("does not mutate the input", () => {
  const input = [
    { timestamp: 1, status: "a" as const },
    { timestamp: 2, status: "a" as const },
  ];
  const snapshot = JSON.parse(JSON.stringify(input));
  const frozen = Object.freeze(input.map((e) => Object.freeze(e)));
  collapseStatusLog(frozen as typeof input); // cast: criteria do not require a readonly parameter type
  expect(input).toEqual(snapshot);
});

it("preserves the literal union in the return type", () => {
  const r = collapseStatusLog([{ timestamp: 1, status: "up" as "up" | "down" }]);
  expectTypeOf(r[0].status).toEqualTypeOf<"up" | "down">();
});

import { expect, it } from "vitest";
import { normalizeScores } from "./solution";

it("returns [] for empty input", () => {
  expect(normalizeScores([])).toEqual([]);
});

it("maps equal values to targetMin without NaN", () => {
  expect(normalizeScores([5, 5, 5])).toEqual([0, 0, 0]);
  expect(normalizeScores([7], 10, 20)).toEqual([10]);
  expect(normalizeScores([2, 2], -1, 1)).toEqual([-1, -1]);
});

it("scales proportionally into the default [0,1]", () => {
  const r = normalizeScores([10, 20, 15, 30]);
  expect(r[0]).toBeCloseTo(0);
  expect(r[1]).toBeCloseTo(0.5);
  expect(r[2]).toBeCloseTo(0.25);
  expect(r[3]).toBeCloseTo(1);
});

it("scales into a custom range, including negative inputs", () => {
  const r = normalizeScores([-10, 0, 10], 100, 200);
  expect(r[0]).toBeCloseTo(100);
  expect(r[1]).toBeCloseTo(150);
  expect(r[2]).toBeCloseTo(200);
});

it("throws RangeError for non-finite values or inverted bounds", () => {
  expect(() => normalizeScores([1, NaN, 3])).toThrow(RangeError);
  expect(() => normalizeScores([1, Infinity])).toThrow(RangeError);
  expect(() => normalizeScores([1, -Infinity, 2])).toThrow(RangeError);
  expect(() => normalizeScores([1, 2, 3], 1, 0)).toThrow(RangeError);
});

it("does not mutate the input", () => {
  const input = Object.freeze([3, 1, 2]);
  normalizeScores(input);
  expect(input).toEqual([3, 1, 2]);
});

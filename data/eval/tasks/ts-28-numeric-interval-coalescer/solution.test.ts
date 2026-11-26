import { expect, it } from "vitest";
import { subtractIntervals } from "./solution";

it("coalesces overlapping and touching base intervals", () => {
  expect(subtractIntervals([[0, 5], [5, 10]], [])).toEqual([[0, 10]]);
  expect(subtractIntervals([[0, 6], [4, 10]], [])).toEqual([[0, 10]]);
  expect(subtractIntervals([[8, 12], [0, 3], [3, 5]], [])).toEqual([[0, 5], [8, 12]]);
});

it("coalesces touching base intervals before subtracting", () => {
  expect(subtractIntervals([[0, 5], [5, 10]], [[4, 6]])).toEqual([[0, 4], [6, 10]]);
});

it("splits a base interval around a cutout strictly inside it", () => {
  expect(subtractIntervals([[0, 10]], [[3, 4]])).toEqual([[0, 3], [4, 10]]);
  expect(subtractIntervals([[0, 10]], [[2, 3], [6, 7]])).toEqual([[0, 2], [3, 6], [7, 10]]);
});

it("returns [] when cutouts cover the whole base", () => {
  expect(subtractIntervals([[2, 8]], [[0, 10]])).toEqual([]);
  expect(subtractIntervals([[2, 8]], [[2, 8]])).toEqual([]);
  expect(subtractIntervals([[0, 4], [4, 8]], [[0, 5], [5, 8]])).toEqual([]);
});

it("trims cutouts that overlap an edge", () => {
  expect(subtractIntervals([[0, 10]], [[-5, 3]])).toEqual([[3, 10]]);
  expect(subtractIntervals([[0, 10]], [[7, 20]])).toEqual([[0, 7]]);
});

it("ignores empty intervals", () => {
  expect(subtractIntervals([[3, 3], [5, 9]], [])).toEqual([[5, 9]]);
  expect(subtractIntervals([[0, 10]], [[4, 4]])).toEqual([[0, 10]]);
  expect(subtractIntervals([[3, 3]], [])).toEqual([]);
});

it("throws RangeError on inverted intervals", () => {
  expect(() => subtractIntervals([[5, 1]], [])).toThrow(RangeError);
  expect(() => subtractIntervals([[0, 10]], [[7, 2]])).toThrow(RangeError);
});

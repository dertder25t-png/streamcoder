import { expect, expectTypeOf, it } from "vitest";
import { chunkArray } from "./solution";

it("splits into chunks of up to size items", () => {
  expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  expect(chunkArray([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  expect(chunkArray([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  expect(chunkArray(["a", "b", "c"], 1)).toEqual([["a"], ["b"], ["c"]]);
  expect(chunkArray<number>([], 3)).toEqual([]);
});

it("does not mutate the input", () => {
  const input = [1, 2, 3, 4, 5];
  chunkArray(input, 2);
  expect(input).toEqual([1, 2, 3, 4, 5]);
});

it("throws RangeError when size is less than 1", () => {
  expect(() => chunkArray([1, 2], 0)).toThrow(RangeError);
  expect(() => chunkArray([1, 2], -3)).toThrow(RangeError);
});

it("keeps the item type T in the return type", () => {
  const nums = chunkArray([1, 2, 3], 2);
  expectTypeOf(nums).toEqualTypeOf<number[][]>();
  const strs = chunkArray<string>(["a"], 1);
  expectTypeOf(strs).toEqualTypeOf<string[][]>();
  type P = { id: number };
  const objs = chunkArray<P>([{ id: 1 }], 1);
  expectTypeOf(objs).toEqualTypeOf<P[][]>();
});

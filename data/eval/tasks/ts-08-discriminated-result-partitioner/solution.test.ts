import { expect, expectTypeOf, it } from "vitest";
import { partitionResults } from "./solution";

type R<T, E> = { ok: true; value: T } | { ok: false; error: E };

it("splits values and errors preserving order", () => {
  const input: R<number, string>[] = [
    { ok: true, value: 1 },
    { ok: false, error: "a" },
    { ok: true, value: 2 },
    { ok: false, error: "b" },
    { ok: true, value: 3 },
  ];
  expect(partitionResults(input)).toEqual({ values: [1, 2, 3], errors: ["a", "b"] });
});

it("handles empty input", () => {
  expect(partitionResults([])).toEqual({ values: [], errors: [] });
});

it("preserves falsy payloads", () => {
  const vals: R<number | string | boolean | null, null | string | number>[] = [
    { ok: true, value: 0 },
    { ok: true, value: "" },
    { ok: true, value: false },
    { ok: true, value: null },
    { ok: false, error: null },
    { ok: false, error: "" },
    { ok: false, error: 0 },
  ];
  const r = partitionResults(vals);
  expect(r.values).toEqual([0, "", false, null]);
  expect(r.errors).toEqual([null, "", 0]);
});

it("is typed as T[] and E[] without assertions", () => {
  const input: R<number, string>[] = [{ ok: true, value: 1 }, { ok: false, error: "x" }];
  const { values, errors } = partitionResults(input);
  const n: number[] = values;
  const s: string[] = errors;
  expectTypeOf(values).toEqualTypeOf<number[]>();
  expectTypeOf(errors).toEqualTypeOf<string[]>();
  expect([n, s]).toEqual([[1], ["x"]]);
});

it("does not mutate the input", () => {
  const input = Object.freeze([{ ok: true as const, value: 1 }]);
  expect(partitionResults(input).values).toEqual([1]);
});

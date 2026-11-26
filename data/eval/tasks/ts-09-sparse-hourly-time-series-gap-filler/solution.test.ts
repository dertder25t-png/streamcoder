import { expect, it } from "vitest";
import { fillMissingHours } from "./solution";

const H = 3_600_000;
const T0 = 1_700_000_000_000 - (1_700_000_000_000 % H);

it("returns shallow copies for empty and single-point input", () => {
  const empty: { hourMs: number; value: number }[] = [];
  const e = fillMissingHours(empty);
  expect(e).toEqual([]);
  expect(e).not.toBe(empty);
  const one = [{ hourMs: T0, value: 4 }];
  const r = fillMissingHours(one);
  expect(r).toEqual([{ hourMs: T0, value: 4 }]);
  expect(r).not.toBe(one);
});

it("fills missing hours with the default 0", () => {
  const r = fillMissingHours([
    { hourMs: T0, value: 5 },
    { hourMs: T0 + 3 * H, value: 8 },
  ]);
  expect(r).toEqual([
    { hourMs: T0, value: 5 },
    { hourMs: T0 + H, value: 0 },
    { hourMs: T0 + 2 * H, value: 0 },
    { hourMs: T0 + 3 * H, value: 8 },
  ]);
});

it("uses a custom fillValue, only between first and last", () => {
  const r = fillMissingHours(
    [
      { hourMs: T0, value: 1 },
      { hourMs: T0 + H, value: 2 },
      { hourMs: T0 + 4 * H, value: 3 },
    ],
    -1,
  );
  expect(r.map((p) => p.hourMs)).toEqual([0, 1, 2, 3, 4].map((k) => T0 + k * H));
  expect(r.map((p) => p.value)).toEqual([1, 2, -1, -1, 3]);
});

it("never overwrites existing values (zero, negatives) and does not mutate input", () => {
  const input = Object.freeze([
    Object.freeze({ hourMs: T0, value: 0 }),
    Object.freeze({ hourMs: T0 + H, value: -7 }),
    Object.freeze({ hourMs: T0 + 2 * H, value: 9 }),
  ]);
  const r = fillMissingHours(input, 99);
  expect(r.map((p) => p.value)).toEqual([0, -7, 9]);
  expect(input).toHaveLength(3);
});

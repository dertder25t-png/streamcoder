import { expect, it } from "vitest";
import { applyObjectDiff, computeObjectDiff } from "./solution";

const snapshot = (v: unknown): string => JSON.stringify(v);

const deepFreeze = <V>(v: V): V => {
  if (typeof v === "object" && v !== null) {
    for (const k of Object.keys(v)) deepFreeze((v as Record<string, unknown>)[k]);
    Object.freeze(v);
  }
  return v;
};

function roundTrip(before: Record<string, unknown>, after: Record<string, unknown>): void {
  const b = JSON.parse(snapshot(before)) as typeof before;
  const a = JSON.parse(snapshot(after)) as typeof after;
  deepFreeze(b);
  deepFreeze(a);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ops = computeObjectDiff(b as any, a as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out = applyObjectDiff(b as any, ops);
  expect(out).toStrictEqual(a);
  expect(snapshot(b)).toBe(snapshot(before));
}

it("round-trips adds, replaces and removes at the top level", () => {
  roundTrip({ a: 1, b: 2 }, { a: 1, b: 3, c: 4 });
  roundTrip({ a: 1, b: 2 }, { b: 2 });
  roundTrip({ a: "x" }, { a: "y" });
  roundTrip({}, { a: 1 });
  roundTrip({ a: 1 }, {});
  roundTrip({ a: 1 }, { a: 1 });
});

it("round-trips nested objects", () => {
  roundTrip(
    { user: { name: "Ada", address: { city: "London", zip: "N1" }, tags: ["a", "b"] }, n: 1 },
    { user: { name: "Ada", address: { city: "Paris" }, tags: ["a", "b", "c"], extra: { deep: [1, { x: 2 }] } }, n: 1 },
  );
  roundTrip({ a: { b: { c: { d: 1 } } } }, { a: { b: { c: { d: 2, e: true } } } });
  roundTrip({ a: { b: 1 } }, { a: 5 });
  roundTrip({ a: 5 }, { a: { b: 1 } });
  roundTrip({ a: [1, 2, 3] }, { a: { 0: 1 } });
  roundTrip({ a: { 0: 1 } }, { a: [1, 2, 3] });
});

it("does not mutate the inputs", () => {
  const before = deepFreeze({ a: { b: 1, c: [1, 2] }, d: "x" });
  const after = deepFreeze({ a: { b: 2 }, e: null });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ops = computeObjectDiff(before as any, after as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out = applyObjectDiff(before as any, ops);
  expect(out).toStrictEqual(after);
  expect(before).toEqual({ a: { b: 1, c: [1, 2] }, d: "x" });
});

it("distinguishes a missing key from a key set to null", () => {
  roundTrip({ a: null }, {});
  roundTrip({}, { a: null });
  roundTrip({ a: 1 }, { a: null });
  roundTrip({ a: null }, { a: 1 });
  roundTrip({ a: null }, { a: null });
  roundTrip({ a: { b: null } }, { a: {} });
  roundTrip({ a: {} }, { a: { b: null } });
  roundTrip({ a: { b: null, c: 1 } }, { a: { b: { x: null } } });
  const out = applyObjectDiff({ a: 1 } as never, computeObjectDiff({ a: 1 } as never, { a: null } as never)) as Record<string, unknown>;
  expect(Object.prototype.hasOwnProperty.call(out, "a")).toBe(true);
  expect(out.a).toBeNull();
  const gone = applyObjectDiff({ a: null } as never, computeObjectDiff({ a: null } as never, {} as never)) as Record<string, unknown>;
  expect(Object.prototype.hasOwnProperty.call(gone, "a")).toBe(false);
});

it("round-trips keys containing dots, slashes and other separators", () => {
  roundTrip({ a: { b: 1 } }, { a: { b: 1 }, "a.b": 2 });
  roundTrip({ a: { b: 1 }, "a.b": 5 }, { a: { b: 1 } });
  roundTrip({ a: { b: 1 }, "a.b": 5 }, { a: { b: 2 }, "a.b": 6 });
  roundTrip({ "a/b": { "c/d": 1 } }, { "a/b": { "c/d": 2, "e.f": 3 } });
  roundTrip({ a: { b: 1 } }, { "a/b": 1 });
  roundTrip({ "": { "": 1 } }, { "": { "": 2 }, x: 1 });
  roundTrip({ "~0": 1, "~1": 2 }, { "~0": 2, "~": 3 });
  roundTrip({ "a.b.c": { "d.e": 1 } }, { "a.b.c": { "d.e": 2 }, a: { b: { c: 1 } } });
});

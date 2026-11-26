import { expect, it } from "vitest";
import { pickDefinedKeys } from "./solution";

const rec = (x: unknown): Record<string, unknown> => x as Record<string, unknown>;

it("keeps falsy but defined values: 0, empty string, false, null", () => {
  const src = { n: 0, s: "", b: false, nul: null as null, ok: 5 };
  const out = pickDefinedKeys(src, ["n", "s", "b", "nul", "ok"]);
  expect(out).toStrictEqual({ n: 0, s: "", b: false, nul: null, ok: 5 });
});

it("omits keys whose value is undefined or that are absent", () => {
  const src: { a?: number; b?: number; c?: number } = { a: 1, b: undefined };
  const out = rec(pickDefinedKeys(src, ["a", "b", "c"]));
  expect(Object.keys(out)).toEqual(["a"]);
  expect("b" in out).toBe(false);
  expect("c" in out).toBe(false);
});

it("copies only the listed keys", () => {
  const src = { a: 1, b: 2, c: 3 };
  expect(pickDefinedKeys(src, ["a", "c"])).toStrictEqual({ a: 1, c: 3 });
  expect(pickDefinedKeys(src, [])).toStrictEqual({});
});

it("never copies inherited prototype properties", () => {
  const proto = { inherited: 42, shared: "p" };
  const child = Object.create(proto) as { inherited?: number; shared?: string; own: number };
  child.own = 1;
  const out = rec(pickDefinedKeys(child, ["own", "inherited", "shared"]));
  expect(Object.keys(out)).toEqual(["own"]);
  expect(out.own).toBe(1);

  const plain = { a: 1 };
  const out2 = rec(pickDefinedKeys(plain, ["toString" as "a", "hasOwnProperty" as "a", "a"]));
  expect(Object.prototype.hasOwnProperty.call(out2, "toString")).toBe(false);
  expect(Object.prototype.hasOwnProperty.call(out2, "hasOwnProperty")).toBe(false);
  expect(out2.a).toBe(1);
});

it("skips non-enumerable own properties and does not mutate the source", () => {
  const src = { a: 1, b: 2 };
  Object.defineProperty(src, "hidden", { value: 9, enumerable: false });
  const out = rec(pickDefinedKeys(src as { a: number; b: number; hidden: number }, ["a", "hidden"]));
  expect(Object.keys(out)).toEqual(["a"]);
  expect(Object.prototype.hasOwnProperty.call(out, "hidden")).toBe(false);
  expect(src).toEqual({ a: 1, b: 2 });
});

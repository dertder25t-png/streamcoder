import { expect, it } from "vitest";
import { deepFreezeSafe } from "./solution";

it("freezes nested objects and arrays", () => {
  const input = { a: { b: { c: 1 } }, list: [{ x: 1 }, [{ y: 2 }]] };
  const out = deepFreezeSafe(input);
  expect(Object.isFrozen(out)).toBe(true);
  expect(Object.isFrozen(input.a)).toBe(true);
  expect(Object.isFrozen(input.a.b)).toBe(true);
  expect(Object.isFrozen(input.list)).toBe(true);
  expect(Object.isFrozen(input.list[0])).toBe(true);
  expect(Object.isFrozen(input.list[1])).toBe(true);
  expect(Object.isFrozen((input.list[1] as unknown[])[0])).toBe(true);
});

it("freezes objects nested under symbol keys", () => {
  const sym = Symbol("hidden");
  const inner = { deep: { v: 1 } };
  const input: Record<symbol, unknown> = { [sym]: inner };
  deepFreezeSafe(input);
  expect(Object.isFrozen(inner)).toBe(true);
  expect(Object.isFrozen(inner.deep)).toBe(true);
});

it("handles self-referential graphs", () => {
  const a: { name: string; self?: unknown; child: { x: number } } = { name: "a", child: { x: 1 } };
  a.self = a;
  expect(() => deepFreezeSafe(a)).not.toThrow();
  expect(Object.isFrozen(a)).toBe(true);
  expect(Object.isFrozen(a.child)).toBe(true);
});

it("handles mutually cyclic graphs", () => {
  const a: { other?: unknown; n: { z: number } } = { n: { z: 1 } };
  const b: { other?: unknown; m: { z: number } } = { m: { z: 2 } };
  a.other = b;
  b.other = a;
  expect(() => deepFreezeSafe(a)).not.toThrow();
  expect(Object.isFrozen(a)).toBe(true);
  expect(Object.isFrozen(b)).toBe(true);
  expect(Object.isFrozen(a.n)).toBe(true);
  expect(Object.isFrozen(b.m)).toBe(true);
});

it("returns primitives and null unchanged", () => {
  expect(deepFreezeSafe(5)).toBe(5);
  expect(deepFreezeSafe("hi")).toBe("hi");
  expect(deepFreezeSafe(true)).toBe(true);
  expect(deepFreezeSafe(null)).toBeNull();
  expect(deepFreezeSafe(undefined)).toBeUndefined();
});

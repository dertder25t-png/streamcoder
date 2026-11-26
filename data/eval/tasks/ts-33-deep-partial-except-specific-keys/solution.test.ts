import { expect, expectTypeOf, it } from "vitest";
import type { DeepPartialExcept } from "./solution";

type User = { id: string; profile: { name: string; age: number } };

it("keeps the listed root keys required", () => {
  type R = DeepPartialExcept<User, "id">;
  expectTypeOf<R["id"]>().toEqualTypeOf<string>();
  const ok: R = { id: "u1" };
  // @ts-expect-error id is required
  const missing: R = {};
  // @ts-expect-error id is required
  const missing2: R = { profile: { name: "a" } };
  expect([ok, missing, missing2].length).toBe(3);
});

it("makes other root and nested properties optional", () => {
  type R = DeepPartialExcept<User, "id">;
  const a: R = { id: "u1" };
  const b: R = { id: "u1", profile: {} };
  const c: R = { id: "u1", profile: { name: "n" } };
  const d: R = { id: "u1", profile: { age: 3 } };
  expect([a, b, c, d].length).toBe(4);
  // wrong value types are still rejected
  // @ts-expect-error age must be a number
  const e: R = { id: "u1", profile: { age: "3" } };
  expect(e).toBeDefined();
});

it("supports several required keys and nested partials", () => {
  type T = { id: number; type: "a" | "b"; meta: { tags: { x: string; y: string }; n: number } };
  type R = DeepPartialExcept<T, "id" | "type">;
  const ok: R = { id: 1, type: "a", meta: { tags: { x: "q" } } };
  // @ts-expect-error type is required
  const bad: R = { id: 1 };
  expect([ok, bad].length).toBe(2);
});

it("rejects keys that are not in T", () => {
  // @ts-expect-error "nope" is not a key of User
  type Bad = DeepPartialExcept<User, "nope">;
  const x: Bad | undefined = undefined;
  expect(x).toBeUndefined();
});

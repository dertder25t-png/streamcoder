import { expect, expectTypeOf, it } from "vitest";
import { s } from "./solution";
import type { Infer } from "./solution";

const user = s.object({
  name: s.string(),
  age: s.number(),
  active: s.boolean(),
  nick: s.optional(s.string()),
  address: s.object({ city: s.string(), zip: s.optional(s.string()) }),
});

it("parses valid input and returns ok with data", () => {
  const r = user.parse({ name: "a", age: 3, active: true, nick: "n", address: { city: "X", zip: "1" } });
  expect(r).toEqual({ ok: true, data: { name: "a", age: 3, active: true, nick: "n", address: { city: "X", zip: "1" } } });
});

it("accepts missing or undefined optional fields", () => {
  const r = user.parse({ name: "a", age: 3, active: false, address: { city: "X" } });
  expect(r.ok).toBe(true);
  const r2 = user.parse({ name: "a", age: 3, active: false, nick: undefined, address: { city: "X" } });
  expect(r2.ok).toBe(true);
  expect(s.optional(s.number()).parse(undefined).ok).toBe(true);
  expect(s.optional(s.number()).parse("x").ok).toBe(false);
});

it("primitive schemas accept only their type", () => {
  expect(s.string().parse("x")).toEqual({ ok: true, data: "x" });
  expect(s.number().parse(1.5)).toEqual({ ok: true, data: 1.5 });
  expect(s.boolean().parse(false)).toEqual({ ok: true, data: false });
  expect(s.string().parse(1).ok).toBe(false);
  expect(s.number().parse("1").ok).toBe(false);
  expect(s.boolean().parse(0).ok).toBe(false);
  expect(s.object({}).parse(null).ok).toBe(false);
  expect(s.object({}).parse([]).ok).toBe(false);
});

it("collects all errors with dot-joined paths", () => {
  const r = user.parse({ name: 1, age: "x", active: true, nick: 5, address: { city: 2, zip: 3 } });
  expect(r.ok).toBe(false);
  if (!r.ok) {
    const paths = r.errors.map((e: { path: string; message: string }) => e.path).sort();
    expect(paths).toEqual(["address.city", "address.zip", "age", "name", "nick"]);
    for (const e of r.errors) expect(typeof e.message).toBe("string");
  }
});

it("reports a missing required nested object at its path", () => {
  const r = user.parse({ name: "a", age: 1, active: true });
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.errors.map((e: { path: string }) => e.path)).toContain("address");
});

it("strips unknown properties, including nested ones", () => {
  const r = user.parse({ name: "a", age: 3, active: true, extra: 1, address: { city: "X", junk: true } });
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.data).toEqual({ name: "a", age: 3, active: true, address: { city: "X" } });
    expect("extra" in r.data).toBe(false);
    expect("junk" in r.data.address).toBe(false);
  }
});

it("Infer makes optional fields optional", () => {
  type U = Infer<typeof user>;
  expectTypeOf<U["name"]>().toEqualTypeOf<string>();
  expectTypeOf<U["address"]["city"]>().toEqualTypeOf<string>();
  const ok: U = { name: "a", age: 1, active: true, address: { city: "c" } };
  // @ts-expect-error name is required
  const bad: U = { age: 1, active: true, address: { city: "c" } };
  void ok;
  void bad;
  expectTypeOf<{ nick?: string | undefined }>().toMatchTypeOf<Pick<U, "nick">>();
  expectTypeOf<Pick<U, "nick">>().toMatchTypeOf<{ nick?: string | undefined }>();
});

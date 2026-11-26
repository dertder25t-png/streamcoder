import { expect, it } from "vitest";
import { parseBooleanFlags } from "./solution";

it("parses true values, false values and bare flags", () => {
  expect(parseBooleanFlags("a=true&b=1&c=yes&d=false&e=0&f=no&debug")).toEqual({
    a: true, b: true, c: true, d: false, e: false, f: false, debug: true,
  });
});

it("leading ? is optional and values are case-insensitive", () => {
  expect(parseBooleanFlags("?x=TRUE&y=No")).toEqual({ x: true, y: false });
  expect(parseBooleanFlags("x=TRUE&y=No")).toEqual({ x: true, y: false });
  expect(parseBooleanFlags("?debug")).toEqual({ debug: true });
  expect(parseBooleanFlags("")).toEqual({});
  expect(parseBooleanFlags("?")).toEqual({});
});

it("uses the last valid occurrence of a repeated key", () => {
  expect(parseBooleanFlags("a=true&a=false")).toEqual({ a: false });
  expect(parseBooleanFlags("a=false&a=1")).toEqual({ a: true });
  expect(parseBooleanFlags("a=true&a=banana")).toEqual({ a: true });
  expect(parseBooleanFlags("a=false&a")).toEqual({ a: true });
});

it("omits keys with unrecognized values", () => {
  const r = parseBooleanFlags("?mode=fast&ok=yes");
  expect(r).toEqual({ ok: true });
  expect("mode" in r).toBe(false);
});

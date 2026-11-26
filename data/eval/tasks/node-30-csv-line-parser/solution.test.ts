import { expect, it } from "vitest";
import { parseCsvLine } from "./solution";

it("splits simple unquoted fields", () => {
  expect(parseCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  expect(parseCsvLine("single")).toEqual(["single"]);
});

it("keeps commas inside double-quoted fields and strips the quotes", () => {
  expect(parseCsvLine('a,"b,c",d')).toEqual(["a", "b,c", "d"]);
  expect(parseCsvLine('"x,y,z",w')).toEqual(["x,y,z", "w"]);
  expect(parseCsvLine('1,"Smith, John",42')).toEqual(["1", "Smith, John", "42"]);
});

it("handles empty fields", () => {
  expect(parseCsvLine("a,,c")).toEqual(["a", "", "c"]);
  expect(parseCsvLine(",,")).toEqual(["", "", ""]);
  expect(parseCsvLine("a,")).toEqual(["a", ""]);
  expect(parseCsvLine('a,"",b')).toEqual(["a", "", "b"]);
});

it("handles a quoted field at the end of the line", () => {
  expect(parseCsvLine('a,"b,c"')).toEqual(["a", "b,c"]);
});

it("preserves spaces inside fields", () => {
  expect(parseCsvLine('hello world,"a b, c"')).toEqual(["hello world", "a b, c"]);
});

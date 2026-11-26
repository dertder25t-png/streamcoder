import { expect, it } from "vitest";
import { safeParseJson } from "./solution";

interface User {
  name: string;
  age: number;
}

const isUser = (val: unknown): val is User => {
  if (typeof val !== "object" || val === null) return false;
  const o = val as Record<string, unknown>;
  return typeof o.name === "string" && typeof o.age === "number";
};

it("returns the parsed object when the validator accepts it", () => {
  const u = safeParseJson('{"name":"Ada","age":36}', isUser);
  expect(u).toEqual({ name: "Ada", age: 36 });
  if (u !== null) {
    const name: string = u.name;
    expect(name).toBe("Ada");
  }
});

it("returns null on invalid JSON", () => {
  expect(safeParseJson("{not json", isUser)).toBeNull();
  expect(safeParseJson("", isUser)).toBeNull();
  const alwaysTrue = (val: unknown): val is unknown => true;
  expect(safeParseJson("{oops", alwaysTrue)).toBeNull();
});

it("returns null when the validator rejects", () => {
  expect(safeParseJson('{"name":"Ada"}', isUser)).toBeNull();
  expect(safeParseJson("42", isUser)).toBeNull();
  expect(safeParseJson("null", isUser)).toBeNull();
});

it("passes the parsed value to the validator", () => {
  let seen: unknown = undefined;
  const spy = (val: unknown): val is number[] => {
    seen = val;
    return Array.isArray(val);
  };
  expect(safeParseJson("[1,2,3]", spy)).toEqual([1, 2, 3]);
  expect(seen).toEqual([1, 2, 3]);
});

import { expect, it } from "vitest";
import { renderTemplate } from "./solution";

it("replaces placeholders, allowing inner whitespace", () => {
  const vars: Record<string, string | number> = { name: "Ada", n: 3 };
  expect(renderTemplate("Hi {{name}}!", vars)).toBe("Hi Ada!");
  expect(renderTemplate("Hi {{ name }}!", vars)).toBe("Hi Ada!");
  expect(renderTemplate("{{  n  }} items, {{name}}{{name}}", vars)).toBe("3 items, AdaAda");
  expect(renderTemplate("no placeholders", vars)).toBe("no placeholders");
});

it("stringifies numbers and keeps falsy values (0 and empty string)", () => {
  const vars: Record<string, string | number> = { zero: 0, empty: "", pi: 3.5 };
  expect(renderTemplate("[{{zero}}][{{empty}}][{{pi}}]", vars)).toBe("[0][][3.5]");
  expect(renderTemplate("[{{zero}}][{{empty}}]", vars, { strict: true })).toBe("[0][]");
});

it("does not re-interpolate replacement values", () => {
  const vars: Record<string, string | number> = { a: "{{b}}", b: "B", c: "{{c}}" };
  expect(renderTemplate("{{a}} {{b}}", vars)).toBe("{{b}} B");
  expect(renderTemplate("{{c}}", vars)).toBe("{{c}}");
  expect(renderTemplate("{{a}}", vars, { strict: true })).toBe("{{b}}");
});

it("inserts replacement values literally", () => {
  const vars: Record<string, string | number> = { v: "$& and $1 and $$" };
  expect(renderTemplate("<{{v}}>", vars)).toBe("<$& and $1 and $$>");
});

it("strict mode throws an Error naming the missing variable", () => {
  const vars: Record<string, string | number> = { a: "x" };
  expect(() => renderTemplate("{{a}} {{missingVar}}", vars, { strict: true })).toThrow(Error);
  expect(() => renderTemplate("{{a}} {{missingVar}}", vars, { strict: true })).toThrow(/missingVar/);
  expect(() => renderTemplate("{{ other }}", vars, { strict: true })).toThrow(/other/);
});

it("non-strict (omitted or false) leaves unknown placeholders untouched", () => {
  const vars: Record<string, string | number> = { a: "x" };
  expect(renderTemplate("{{a}} {{nope}}", vars)).toBe("x {{nope}}");
  expect(renderTemplate("{{a}} {{ nope }}", vars, { strict: false })).toBe("x {{ nope }}");
  expect(renderTemplate("{{a}} {{nope}}", vars, {})).toBe("x {{nope}}");
});

it("does not treat inherited object properties as variables", () => {
  const vars: Record<string, string | number> = {};
  expect(renderTemplate("{{toString}}", vars)).toBe("{{toString}}");
  expect(() => renderTemplate("{{constructor}}", vars, { strict: true })).toThrow(/constructor/);
});

import { expect, it } from "vitest";
import { formatCsvRow } from "./solution";

// A row may or may not carry a trailing line terminator; ignore one.
const row = (cells: Parameters<typeof formatCsvRow>[0]) => formatCsvRow(cells).replace(/\r?\n$/, "");

it("joins plain cells and renders null/undefined as empty fields", () => {
  expect(row(["a", 1, true, null, undefined, "z"])).toBe("a,1,true,,,z");
  expect(row([])).toBe("");
});

it("quotes cells with commas, quotes or newlines and doubles inner quotes", () => {
  expect(row(["a,b"])).toBe('"a,b"');
  expect(row(['say "hi"'])).toBe('"say ""hi"""');
  expect(row(["line1\nline2"])).toBe('"line1\nline2"');
  expect(row(["x", "y,z"])).toBe('x,"y,z"');
});

it("prefixes formula-looking strings with a single quote", () => {
  expect(row(["=1+1"])).toBe("'=1+1");
  expect(row(["+cmd"])).toBe("'+cmd");
  expect(row(["-cmd"])).toBe("'-cmd");
  expect(row(["@SUM(A1)"])).toBe("'@SUM(A1)");
  expect(row(["=SUM(A1,A2)"])).toBe(`"'=SUM(A1,A2)"`);
});

it("does not prefix ordinary strings or real numbers", () => {
  expect(row([-42])).toBe("-42");
  expect(row([-1.5, 0])).toBe("-1.5,0");
  expect(row(["a=b"])).toBe("a=b");
  expect(row(["-5"])).toBe("'-5");
});

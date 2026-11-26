import { expect, it } from "vitest";
import { parseDotEnv } from "./solution";

it("parses basic pairs, comments, blank lines and export prefixes", () => {
  const env = parseDotEnv("# comment\n\nA=1\nexport B=two\n   C = spaced   \n");
  expect(env).toEqual({ A: "1", B: "two", C: "spaced" });
});

it("handles CRLF and keeps = inside values", () => {
  expect(parseDotEnv("URL=postgres://u:p@h/db?x=1\r\nK=v\r\n")).toEqual({ URL: "postgres://u:p@h/db?x=1", K: "v" });
});

it("strips inline comments only outside quotes", () => {
  const env = parseDotEnv('A=value # note\nB="keep # this"\nC=\'and # this\'');
  expect(env).toEqual({ A: "value", B: "keep # this", C: "and # this" });
});

it("expands escapes in double quotes but not in single quotes", () => {
  const env = parseDotEnv('D="line1\\nline2 \\"q\\""\nS=\'raw\\ntext\'');
  expect(env.D).toBe('line1\nline2 "q"');
  expect(env.S).toBe("raw\\ntext");
});

it("preserves interior spaces in quoted values", () => {
  expect(parseDotEnv('Q="  padded  "')).toEqual({ Q: "  padded  " });
});

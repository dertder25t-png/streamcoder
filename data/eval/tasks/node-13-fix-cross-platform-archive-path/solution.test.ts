import { expect, it } from "vitest";
import { normalizeArchivePaths } from "./solution";

it("converts backslashes, collapses duplicate slashes, strips ./ and / prefixes", () => {
  expect(
    normalizeArchivePaths(["a\\b\\c.txt", "dir//sub///file.js", "./x/y.txt", "/abs/path.txt", ".\\win\\f.txt", "\\root\\g.txt", "//double/lead.txt"]),
  ).toEqual(["a/b/c.txt", "dir/sub/file.js", "x/y.txt", "abs/path.txt", "win/f.txt", "root/g.txt", "double/lead.txt"]);
});

it("returns an empty array for no input", () => {
  expect(normalizeArchivePaths([])).toEqual([]);
});

it("throws on parent traversal segments", () => {
  for (const bad of ["../evil.txt", "a/../../b", "a/b/..", "..\\evil.txt", "a\\..\\..\\b", "./../x", "/../x"]) {
    expect(() => normalizeArchivePaths(["ok.txt", bad])).toThrow(Error);
  }
});

it("does not treat dotted names as traversal", () => {
  expect(normalizeArchivePaths(["a/..b/c", "a/b../c", ".hidden/file", "a/...", "v1.2/x"])).toEqual([
    "a/..b/c",
    "a/b../c",
    ".hidden/file",
    "a/...",
    "v1.2/x",
  ]);
});

it("throws on Windows drive prefixes", () => {
  for (const bad of ["C:\\Windows\\system32", "c:/temp/x.txt", "D:file.txt"]) {
    expect(() => normalizeArchivePaths([bad])).toThrow(Error);
  }
});

it("deduplicates normalized entries preserving first-seen order", () => {
  expect(normalizeArchivePaths(["b.txt", "a/x", "./b.txt", "a\\x", "/b.txt", "c", "a//x", "c"])).toEqual(["b.txt", "a/x", "c"]);
});

import { mkdtempSync, mkdirSync, rmSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { summarizeByExtension } from "./solution";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "sum-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

it("resolves {} for an empty directory", async () => {
  expect(await summarizeByExtension(dir)).toEqual({});
});

it("aggregates nested directories with lowercase extension keys", async () => {
  mkdirSync(join(dir, "a/b"), { recursive: true });
  writeFileSync(join(dir, "A.TS"), "12345");
  writeFileSync(join(dir, "a/b.ts"), "123");
  writeFileSync(join(dir, "a/b/c.ts"), "1");
  writeFileSync(join(dir, "a/b/d.md"), "ab");
  expect(await summarizeByExtension(dir)).toEqual({
    ".ts": { count: 3, bytes: 9 },
    ".md": { count: 1, bytes: 2 },
  });
});

it("groups extensionless files and dotfiles under (no-ext)", async () => {
  writeFileSync(join(dir, "Makefile"), "abc");
  writeFileSync(join(dir, ".gitignore"), "xy");
  writeFileSync(join(dir, "x.txt"), "z");
  expect(await summarizeByExtension(dir)).toEqual({
    "(no-ext)": { count: 2, bytes: 5 },
    ".txt": { count: 1, bytes: 1 },
  });
});

it("skips symbolic links to files and directories", async () => {
  mkdirSync(join(dir, "real"));
  writeFileSync(join(dir, "real/f.js"), "1234");
  writeFileSync(join(dir, "target.js"), "12");
  symlinkSync(join(dir, "target.js"), join(dir, "link.js"));
  symlinkSync(join(dir, "real"), join(dir, "linkdir"));
  expect(await summarizeByExtension(dir)).toEqual({ ".js": { count: 2, bytes: 6 } });
});

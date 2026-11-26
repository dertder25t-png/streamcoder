import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { compareDirectories } from "./solution";

let root: string;
let a: string;
let b: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "diff-"));
  a = join(root, "a");
  b = join(root, "b");
  mkdirSync(a);
  mkdirSync(b);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const put = (base: string, rel: string, content: string | Buffer) => {
  const p = join(base, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
  return p;
};

it("reports added, removed and modified files", async () => {
  put(a, "same.txt", "same");
  put(a, "gone.txt", "bye");
  put(a, "change.txt", "old");
  put(b, "same.txt", "same");
  put(b, "new.txt", "hi");
  put(b, "change.txt", "new");
  expect(await compareDirectories(a, b)).toEqual({
    added: ["new.txt"],
    removed: ["gone.txt"],
    modified: ["change.txt"],
  });
});

it("returns empty lists for identical directories, including two empty ones", async () => {
  expect(await compareDirectories(a, b)).toEqual({ added: [], removed: [], modified: [] });
  put(a, "x/y.txt", "1");
  put(b, "x/y.txt", "1");
  expect(await compareDirectories(a, b)).toEqual({ added: [], removed: [], modified: [] });
});

it("ignores modification timestamps when bytes are identical", async () => {
  const pa = put(a, "f.txt", "identical");
  const pb = put(b, "f.txt", "identical");
  utimesSync(pa, new Date("2001-01-01T00:00:00Z"), new Date("2001-01-01T00:00:00Z"));
  utimesSync(pb, new Date("2024-06-01T00:00:00Z"), new Date("2024-06-01T00:00:00Z"));
  expect((await compareDirectories(a, b)).modified).toEqual([]);
});

it("detects content changes even with the same size and same timestamps", async () => {
  const pa = put(a, "f.bin", Buffer.from([1, 2, 3, 4]));
  const pb = put(b, "f.bin", Buffer.from([1, 2, 3, 5]));
  const t = new Date("2020-01-01T00:00:00Z");
  utimesSync(pa, t, t);
  utimesSync(pb, t, t);
  expect((await compareDirectories(a, b)).modified).toEqual(["f.bin"]);
});

it("returns sorted forward-slash relative paths across nested subdirectories", async () => {
  put(a, "d/deep/z.txt", "1");
  put(a, "d/a.txt", "1");
  put(b, "d/deep/z.txt", "2");
  put(b, "d/a.txt", "2");
  put(b, "d/deep/er/new2.txt", "n");
  put(b, "d/deep/new1.txt", "n");
  put(b, "b.txt", "n");
  put(a, "q/r/old2.txt", "o");
  put(a, "q/old1.txt", "o");
  const r = await compareDirectories(a, b);
  expect(r.modified).toEqual(["d/a.txt", "d/deep/z.txt"]);
  expect(r.added).toEqual(["b.txt", "d/deep/er/new2.txt", "d/deep/new1.txt"]);
  expect(r.removed).toEqual(["q/old1.txt", "q/r/old2.txt"]);
});

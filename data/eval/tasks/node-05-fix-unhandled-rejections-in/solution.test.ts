import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { readExistingFiles } from "./solution";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "rd-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const entries = (m: any): [string, string][] => (m instanceof Map ? [...m.entries()] : Object.entries(m));

it("returns contents of existing files and omits ENOENT paths", async () => {
  const a = join(dir, "a.txt");
  const b = join(dir, "b.txt");
  writeFileSync(a, "alpha");
  writeFileSync(b, "bé");
  const missing = join(dir, "missing.txt");
  const res = await readExistingFiles([a, missing, b]);
  const e = Object.fromEntries(entries(res));
  expect(e).toEqual({ [a]: "alpha", [b]: "bé" });
});

it("resolves to an empty map when every file is missing or the list is empty", async () => {
  expect(entries(await readExistingFiles([join(dir, "x"), join(dir, "y")]))).toEqual([]);
  expect(entries(await readExistingFiles([]))).toEqual([]);
});

it("re-throws non-ENOENT errors such as EISDIR", async () => {
  const a = join(dir, "a.txt");
  writeFileSync(a, "alpha");
  const sub = join(dir, "sub");
  mkdirSync(sub);
  await expect(readExistingFiles([a, join(dir, "missing"), sub])).rejects.toMatchObject({ code: "EISDIR" });
});

it("does not emit unhandled rejections when several reads fail", async () => {
  const sub1 = join(dir, "s1");
  const sub2 = join(dir, "s2");
  mkdirSync(sub1);
  mkdirSync(sub2);
  const unhandled: unknown[] = [];
  const handler = (r: unknown) => unhandled.push(r);
  process.on("unhandledRejection", handler);
  try {
    await expect(readExistingFiles([sub1, sub2, join(dir, "gone")])).rejects.toBeTruthy();
    await new Promise((r) => setTimeout(r, 50));
  } finally {
    process.off("unhandledRejection", handler);
  }
  expect(unhandled).toEqual([]);
});

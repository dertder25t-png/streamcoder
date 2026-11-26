import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { readJsonSafe } from "./solution";

let dir = "";
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "rjs-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

it("returns parsed JSON for a valid file", async () => {
  const p = join(dir, "a.json");
  await writeFile(p, JSON.stringify({ a: 1, b: [1, 2, { c: "x" }] }));
  expect(await readJsonSafe<unknown>(p, null)).toEqual({ a: 1, b: [1, 2, { c: "x" }] });
});

it("returns falsy parsed values rather than the fallback", async () => {
  const p = join(dir, "z.json");
  await writeFile(p, "0");
  expect(await readJsonSafe<number>(p, 42)).toBe(0);
  await writeFile(p, "false");
  expect(await readJsonSafe<boolean>(p, true)).toBe(false);
});

it("returns the fallback when the file is missing", async () => {
  const fb = { def: true };
  expect(await readJsonSafe(join(dir, "nope.json"), fb)).toBe(fb);
  expect(await readJsonSafe<string | null>(join(dir, "nope.json"), null)).toBeNull();
});

it("returns the fallback when the JSON is malformed", async () => {
  const p = join(dir, "bad.json");
  await writeFile(p, '{"a": 1,');
  expect(await readJsonSafe(p, { def: 1 })).toEqual({ def: 1 });
  await writeFile(p, "");
  expect(await readJsonSafe(p, [] as number[])).toEqual([]);
  await writeFile(p, "not json at all");
  expect(await readJsonSafe<string | null>(p, "fb")).toBe("fb");
});

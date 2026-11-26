import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { writeJsonAtomic } from "./solution";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "atomic-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

it("writes pretty-printed JSON with trailing newline and leaves no temp files", async () => {
  const p = join(dir, "data.json");
  const data = { a: 1, list: [1, 2], s: "héllo ✓" };
  await writeJsonAtomic(p, data);
  const text = readFileSync(p, "utf8");
  expect(text).toBe(JSON.stringify(data, null, 2) + "\n");
  expect(readdirSync(dir)).toEqual(["data.json"]);
});

it("overwrites an existing file", async () => {
  const p = join(dir, "data.json");
  writeFileSync(p, "old");
  await writeJsonAtomic(p, { n: 2 });
  expect(JSON.parse(readFileSync(p, "utf8"))).toEqual({ n: 2 });
  expect(readdirSync(dir)).toEqual(["data.json"]);
});

it("keeps the existing file and leaves no temp file when serialization fails", async () => {
  const p = join(dir, "data.json");
  writeFileSync(p, '{"keep":true}\n');
  const circ: any = {};
  circ.self = circ;
  await expect(writeJsonAtomic(p, circ)).rejects.toBeTruthy();
  expect(readFileSync(p, "utf8")).toBe('{"keep":true}\n');
  expect(readdirSync(dir)).toEqual(["data.json"]);
});

it("keeps the existing file and leaves no temp file when the write fails", async () => {
  const p = join(dir, "target");
  mkdirSync(p); // renaming a file over a directory fails
  writeFileSync(join(p, "inner.txt"), "x");
  await expect(writeJsonAtomic(p, { a: 1 })).rejects.toBeTruthy();
  expect(readdirSync(dir)).toEqual(["target"]);
  expect(readdirSync(p)).toEqual(["inner.txt"]);
});

it("concurrent writes to the same path never corrupt the file or leave temps", async () => {
  const p = join(dir, "data.json");
  const payloads = Array.from({ length: 20 }, (_, i) => ({ id: i, pad: "x".repeat(20000 + i) }));
  await Promise.all(payloads.map((d) => writeJsonAtomic(p, d)));
  const parsed = JSON.parse(readFileSync(p, "utf8"));
  expect(payloads.map((d) => d.id)).toContain(parsed.id);
  expect(parsed.pad.length).toBe(20000 + parsed.id);
  expect(readdirSync(dir)).toEqual(["data.json"]);
});

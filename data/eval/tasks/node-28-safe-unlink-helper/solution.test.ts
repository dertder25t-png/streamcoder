import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { removeFileSafe } from "./solution";

let dir = "";
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "rfs-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const exists = (p: string) => access(p).then(() => true, () => false);

it("deletes an existing file and returns true", async () => {
  const p = join(dir, "f.txt");
  await writeFile(p, "hi");
  expect(await removeFileSafe(p)).toBe(true);
  expect(await exists(p)).toBe(false);
});

it("returns false and does not throw when the file does not exist", async () => {
  expect(await removeFileSafe(join(dir, "missing.txt"))).toBe(false);
});

it("returns false for a second delete of the same file", async () => {
  const p = join(dir, "g.txt");
  await writeFile(p, "x");
  expect(await removeFileSafe(p)).toBe(true);
  expect(await removeFileSafe(p)).toBe(false);
});

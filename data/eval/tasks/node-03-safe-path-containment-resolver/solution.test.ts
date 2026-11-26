import { resolve, join } from "node:path";
import { expect, it } from "vitest";
import { resolveInsideRoot } from "./solution";

const root = resolve("/srv/app");

it("resolves simple and normalized relative paths under root", () => {
  expect(resolveInsideRoot(root, "a/b.txt")).toBe(join(root, "a", "b.txt"));
  expect(resolveInsideRoot(root, "a/../b.txt")).toBe(join(root, "b.txt"));
  expect(resolveInsideRoot(root, "./x/./y")).toBe(join(root, "x", "y"));
});

it("returns an absolute path", () => {
  expect(resolve(resolveInsideRoot(root, "z"))).toBe(resolveInsideRoot(root, "z"));
});

it("accepts an absolute userPath that is inside root", () => {
  expect(resolveInsideRoot(root, join(root, "inner", "f.txt"))).toBe(join(root, "inner", "f.txt"));
});

it("rejects traversal escapes", () => {
  expect(() => resolveInsideRoot(root, "../secret")).toThrow(Error);
  expect(() => resolveInsideRoot(root, "a/../../secret")).toThrow(Error);
  expect(() => resolveInsideRoot(root, "..")).toThrow(Error);
});

it("rejects absolute paths outside root", () => {
  expect(() => resolveInsideRoot(root, "/etc/passwd")).toThrow(Error);
});

it("rejects null bytes", () => {
  expect(() => resolveInsideRoot(root, "a\0b")).toThrow(Error);
  expect(() => resolveInsideRoot(root, "ok.txt\0.png")).toThrow(Error);
});

it("rejects sibling directories sharing the root name prefix", () => {
  expect(() => resolveInsideRoot(root, "../app-backup/data.txt")).toThrow(Error);
  expect(() => resolveInsideRoot(root, "/srv/app-backup/data.txt")).toThrow(Error);
});

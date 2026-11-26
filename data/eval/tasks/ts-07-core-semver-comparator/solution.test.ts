import { expect, it } from "vitest";
import { compareSemverCore } from "./solution";

it("compares numerically, not as text", () => {
  expect(compareSemverCore("1.10.0", "1.2.9")).toBe(1);
  expect(compareSemverCore("1.2.9", "1.10.0")).toBe(-1);
  expect(compareSemverCore("2.0.0", "10.0.0")).toBe(-1);
  expect(compareSemverCore("0.0.1", "0.0.10")).toBe(-1);
});

it("treats a leading v as equal", () => {
  expect(compareSemverCore("v2.0.0", "2.0.0")).toBe(0);
  expect(compareSemverCore("1.2.3", "1.2.3")).toBe(0);
});

it("throws on malformed input", () => {
  for (const bad of ["1.2", "1.02.0", "1.2.x", "", "1.2.3.4", "vv1.0.0", "-1.0.0"]) {
    expect(() => compareSemverCore(bad, "1.0.0"), bad).toThrow(Error);
    expect(() => compareSemverCore("1.0.0", bad), bad).toThrow(Error);
  }
});

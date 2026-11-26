import { expect, it } from "vitest";
import { createHeaderMap } from "./solution";

it("looks headers up case-insensitively", () => {
  const h = createHeaderMap([["Content-Type", "text/html"]]);
  expect(h.get("content-type")).toBe("text/html");
  expect(h.get("CONTENT-TYPE")).toBe("text/html");
  expect(h.has("CONTENT-TYPE")).toBe(true);
  expect(h.has("content-length")).toBe(false);
  expect(h.get("x-missing")).toBeUndefined();
});

it("works when created empty and via set", () => {
  const h = createHeaderMap();
  h.set("X-Id", "1");
  expect(h.get("x-id")).toBe("1");
  expect(h.toRecord()).toEqual({ "X-Id": "1" });
});

it("overwriting with different casing replaces value and key casing without duplicates", () => {
  const h = createHeaderMap([["Content-Type", "a"]]);
  h.set("content-type", "b");
  expect(h.get("Content-Type")).toBe("b");
  expect(h.toRecord()).toEqual({ "content-type": "b" });
  h.set("CONTENT-TYPE", "c");
  expect(h.toRecord()).toEqual({ "CONTENT-TYPE": "c" });
  expect(Object.keys(h.toRecord())).toHaveLength(1);
});

it("later initial entries override earlier ones case-insensitively", () => {
  const h = createHeaderMap([["Accept", "1"], ["ACCEPT", "2"]]);
  expect(h.toRecord()).toEqual({ ACCEPT: "2" });
});

it("delete is case-insensitive and reports whether it existed", () => {
  const h = createHeaderMap([["Authorization", "x"], ["Accept", "y"]]);
  expect(h.delete("AUTHORIZATION")).toBe(true);
  expect(h.has("authorization")).toBe(false);
  expect(h.delete("authorization")).toBe(false);
  expect(h.toRecord()).toEqual({ Accept: "y" });
});

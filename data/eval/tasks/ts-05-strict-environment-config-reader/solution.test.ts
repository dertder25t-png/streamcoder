import { expect, it } from "vitest";
import { readEnvConfig } from "./solution";

type Spec = Record<string, { type: "string" | "int" | "boolean"; required?: boolean; default?: string | number | boolean }>;
const spec: Spec = {
  HOST: { type: "string", required: true },
  PORT: { type: "int", default: 8080 },
  DEBUG: { type: "boolean", default: false },
  NAME: { type: "string", default: "app" },
  OPT: { type: "string" },
};

it("parses values by type", () => {
  const c = readEnvConfig({ HOST: "h", PORT: "3000", DEBUG: "true", NAME: "x", OPT: "o" }, spec);
  expect(c).toMatchObject({ HOST: "h", PORT: 3000, DEBUG: true, NAME: "x", OPT: "o" });
  expect(readEnvConfig({ HOST: "h", DEBUG: "false" }, spec).DEBUG).toBe(false);
  expect(readEnvConfig({ HOST: "h", PORT: "-5" }, spec).PORT).toBe(-5);
});

it("uses defaults for missing optional keys; no default gives undefined", () => {
  const c = readEnvConfig({ HOST: "h" }, spec);
  expect(c.PORT).toBe(8080);
  expect(c.DEBUG).toBe(false);
  expect(c.NAME).toBe("app");
  expect(c.OPT).toBeUndefined();
});

it("throws listing every missing required key", () => {
  const s: Spec = { A: { type: "string", required: true }, B: { type: "int", required: true }, C: { type: "string", required: true } };
  let msg = "";
  try {
    readEnvConfig({ B: "1" }, s);
  } catch (e) {
    expect(e).toBeInstanceOf(Error);
    msg = (e as Error).message;
  }
  expect(msg).toContain("A");
  expect(msg).toContain("C");
  expect(() => readEnvConfig({}, s)).toThrow(Error);
});

it("treats empty string for a required key as missing", () => {
  expect(() => readEnvConfig({ HOST: "" }, spec)).toThrow(/HOST/);
});

it("throws on unparseable integers and names every failing key", () => {
  for (const bad of ["12px", "3.5", "abc", "1e3"]) {
    expect(() => readEnvConfig({ HOST: "h", PORT: bad }, spec), bad).toThrow(/PORT/);
  }
  const s: Spec = { P: { type: "int" }, Q: { type: "int" }, R: { type: "int" } };
  let msg = "";
  try {
    readEnvConfig({ P: "x", Q: "2", R: "y" }, s);
  } catch (e) {
    msg = (e as Error).message;
  }
  expect(msg).toContain("P");
  expect(msg).toContain("R");
  expect(msg).not.toContain("Q");
});

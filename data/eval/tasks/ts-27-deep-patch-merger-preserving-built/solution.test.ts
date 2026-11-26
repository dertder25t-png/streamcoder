import { expect, it } from "vitest";
import { applyDeepPatch, type DeepPatch } from "./solution";

type Cfg = {
  name: string;
  server: { host: string; port: number; tls: { on: boolean; cert: string } };
  tags: string[];
  created: Date;
  pattern: RegExp;
  hook: () => number;
};

const mk = (): Cfg => ({
  name: "app",
  server: { host: "a", port: 1, tls: { on: false, cert: "c1" } },
  tags: ["x", "y", "z"],
  created: new Date(0),
  pattern: /a/g,
  hook: () => 1,
});

it("merges nested plain objects deeply", () => {
  const out = applyDeepPatch(mk(), { server: { tls: { on: true } } });
  expect(out.server.tls).toEqual({ on: true, cert: "c1" });
  expect(out.server.host).toBe("a");
  expect(out.server.port).toBe(1);
  expect(out.name).toBe("app");
});

it("does not mutate base or patch", () => {
  const base = mk();
  const patch: DeepPatch<Cfg> = { server: { port: 9, tls: { cert: "c2" } } };
  const patchCopy = JSON.stringify(patch);
  const out = applyDeepPatch(base, patch);
  expect(base.server.port).toBe(1);
  expect(base.server.tls.cert).toBe("c1");
  expect(JSON.stringify(patch)).toBe(patchCopy);
  expect(out).not.toBe(base);
  expect(out.server).not.toBe(base.server);
  expect(out.server.tls.cert).toBe("c2");
});

it("replaces arrays, Dates and RegExps wholesale", () => {
  const d = new Date(5000);
  const re = /b+/i;
  const out = applyDeepPatch(mk(), { tags: ["q"], created: d, pattern: re });
  expect(out.tags).toEqual(["q"]);
  expect(out.created).toBe(d);
  expect(out.pattern).toBe(re);
  expect(out.created instanceof Date).toBe(true);
  expect(out.pattern instanceof RegExp).toBe(true);
});

it("DeepPatch does not make Date or function properties partial objects", () => {
  const a: DeepPatch<{ d: Date }> = { d: new Date() };
  // @ts-expect-error a plain object is not a Date
  const b: DeepPatch<{ d: Date }> = { d: {} };
  const c: DeepPatch<{ f: () => number }> = { f: () => 2 };
  // @ts-expect-error a plain object is not a function
  const e: DeepPatch<{ f: () => number }> = { f: {} };
  expect([a, b, c, e].length).toBe(4);
});

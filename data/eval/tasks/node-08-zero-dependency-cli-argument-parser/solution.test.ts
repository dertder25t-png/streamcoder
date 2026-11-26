import { expect, it } from "vitest";
import { parseCliArgs } from "./solution";

const schema = {
  verbose: { type: "boolean" as const, alias: "v" },
  color: { type: "boolean" as const, default: true },
  port: { type: "number" as const, alias: "p", default: 3000 },
  name: { type: "string" as const },
};

it("parses boolean flags and --no-<name> negation", () => {
  expect(parseCliArgs(["--verbose", "--no-color"], schema).options).toMatchObject({ verbose: true, color: false });
});

it("parses --key=value and --key value identically, converting numbers", () => {
  const a = parseCliArgs(["--port", "8080", "--name", "x"], schema);
  const b = parseCliArgs(["--port=8080", "--name=x"], schema);
  expect(a).toEqual(b);
  expect(a.options.port).toBe(8080);
  expect(a.options.name).toBe("x");
});

it("supports short aliases and positionals", () => {
  const r = parseCliArgs(["in.txt", "-p", "9000", "-v", "out.txt"], schema);
  expect(r.options).toMatchObject({ port: 9000, verbose: true });
  expect(r.positionals).toEqual(["in.txt", "out.txt"]);
});

it("treats everything after -- as positional, even with a dash prefix", () => {
  const r = parseCliArgs(["--verbose", "--", "--port", "-p", "file"], schema);
  expect(r.options.verbose).toBe(true);
  expect(r.options.port).toBe(3000);
  expect(r.positionals).toEqual(["--port", "-p", "file"]);
});

it("throws on a valued option without a value", () => {
  expect(() => parseCliArgs(["--port"], schema)).toThrow(Error);
  expect(() => parseCliArgs(["--name"], schema)).toThrow(Error);
  expect(() => parseCliArgs(["-p"], schema)).toThrow(Error);
});

it("throws on unknown flags", () => {
  expect(() => parseCliArgs(["--nope"], schema)).toThrow(Error);
  expect(() => parseCliArgs(["-z"], schema)).toThrow(Error);
});

it("applies defaults for omitted options and omits those without default", () => {
  const r = parseCliArgs([], schema);
  expect(r.options.port).toBe(3000);
  expect(r.options.color).toBe(true);
  expect("name" in r.options).toBe(false);
  expect(r.positionals).toEqual([]);
});

it("does not mutate argv", () => {
  const argv = Object.freeze(["--port", "1", "--", "a"]) as readonly string[];
  const copy = [...argv];
  parseCliArgs(argv, schema);
  expect([...argv]).toEqual(copy);
});

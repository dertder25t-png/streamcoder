import { expect, it } from "vitest";
import { setByPath } from "./solution";

type State = {
  user: { name: string; address: { city: string; zip: number } };
  settings: { theme: "light" | "dark"; flags: { beta: boolean } };
  count: number;
};

const makeState = (): State => ({
  user: { name: "Ada", address: { city: "London", zip: 1234 } },
  settings: { theme: "light", flags: { beta: false } },
  count: 1,
});

it("returns a new object with the nested leaf updated", () => {
  const s = makeState();
  const next = setByPath(s, "user.address.city", "Paris");
  expect(next.user.address.city).toBe("Paris");
  expect(next).not.toBe(s);
  expect(next.user).not.toBe(s.user);
  expect(next.user.address).not.toBe(s.user.address);
  expect(next.user.address.zip).toBe(1234);
  expect(next.user.name).toBe("Ada");
  expect(next.count).toBe(1);
});

it("updates top-level and mid-level paths", () => {
  const s = makeState();
  expect(setByPath(s, "count", 5).count).toBe(5);
  expect(setByPath(s, "settings.theme", "dark").settings.theme).toBe("dark");
  const replaced = setByPath(s, "user.address", { city: "Rome", zip: 1 });
  expect(replaced.user.address).toEqual({ city: "Rome", zip: 1 });
  expect(replaced.user.name).toBe("Ada");
});

it("leaves the input untouched", () => {
  const s = makeState();
  const frozen = JSON.parse(JSON.stringify(s)) as State;
  setByPath(s, "user.address.city", "Paris");
  setByPath(s, "settings.flags.beta", true);
  expect(s).toEqual(frozen);
  const deepFreeze = <V>(v: V): V => {
    if (typeof v === "object" && v !== null) {
      for (const k of Object.keys(v)) deepFreeze((v as Record<string, unknown>)[k]);
      Object.freeze(v);
    }
    return v;
  };
  const f = deepFreeze(makeState());
  expect(setByPath(f, "user.address.zip", 99).user.address.zip).toBe(99);
});

it("shares untouched sibling branches by reference", () => {
  const s = makeState();
  const next = setByPath(s, "user.address.city", "Paris");
  expect(next.settings).toBe(s.settings);
  expect(next.settings.flags).toBe(s.settings.flags);
  expect(next.user.address).not.toBe(s.user.address);
  const next2 = setByPath(s, "settings.flags.beta", true);
  expect(next2.user).toBe(s.user);
  expect(next2.user.address).toBe(s.user.address);
});

it("rejects invalid paths and mismatched value types at compile time", () => {
  const s = makeState();
  const run = (fn: () => void): void => {
    try {
      fn();
    } catch {
      /* runtime result is irrelevant, only the compile-time check matters */
    }
  };
  run(() => {
    // @ts-expect-error unknown top-level key
    setByPath(s, "nope", 1);
  });
  run(() => {
    // @ts-expect-error unknown nested key
    setByPath(s, "user.address.country", "UK");
  });
  run(() => {
    // @ts-expect-error value type must be string
    setByPath(s, "user.name", 42);
  });
  run(() => {
    // @ts-expect-error value type must be number
    setByPath(s, "user.address.zip", "1234");
  });
  run(() => {
    // @ts-expect-error literal union value
    setByPath(s, "settings.theme", "blue");
  });
  expect(true).toBe(true);
});

it("throws on __proto__, constructor and prototype segments", () => {
  const s = makeState();
  const loose = setByPath as unknown as (o: object, p: string, v: unknown) => unknown;
  for (const p of [
    "__proto__",
    "__proto__.polluted",
    "user.__proto__.polluted",
    "constructor",
    "constructor.prototype.polluted",
    "user.constructor",
    "prototype",
    "user.prototype.x",
  ]) {
    expect(() => loose(s, p, "x"), p).toThrow(Error);
  }
  expect(({} as Record<string, unknown>).polluted).toBeUndefined();
});

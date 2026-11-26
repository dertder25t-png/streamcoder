import { expect, it } from "vitest";
import { createTypedBus } from "./solution";

type Events = {
  greet: { name: string };
  count: number;
  reset: void;
};

it("delivers payloads to on listeners in registration order", () => {
  const bus = createTypedBus<Events>();
  const log: string[] = [];
  bus.on("greet", (p: { name: string }) => log.push("a:" + p.name));
  bus.on("greet", (p: { name: string }) => log.push("b:" + p.name));
  bus.on("count", (n: number) => log.push("n:" + n));
  bus.emit("greet", { name: "Ada" });
  bus.emit("count", 0);
  expect(log).toEqual(["a:Ada", "b:Ada", "n:0"]);
});

it("emitting with no listeners does nothing", () => {
  const bus = createTypedBus<Events>();
  expect(() => bus.emit("reset")).not.toThrow();
  expect(() => bus.emit("count", 1)).not.toThrow();
});

it("void events are emitted with just the event name", () => {
  const bus = createTypedBus<Events>();
  let n = 0;
  bus.on("reset", () => {
    n++;
  });
  bus.emit("reset");
  bus.emit("reset");
  expect(n).toBe(2);
});

it("once listeners fire a single time, and their unsubscribe works before firing", () => {
  const bus = createTypedBus<Events>();
  const seen: number[] = [];
  bus.once("count", (n: number) => seen.push(n));
  bus.emit("count", 1);
  bus.emit("count", 2);
  expect(seen).toEqual([1]);

  const never: number[] = [];
  const un = bus.once("count", (n: number) => never.push(n));
  un();
  bus.emit("count", 3);
  expect(never).toEqual([]);
});

it("unsubscribe functions work and are idempotent without affecting other listeners", () => {
  const bus = createTypedBus<Events>();
  const calls: string[] = [];
  const unA = bus.on("count", (n: number) => calls.push("A" + n));
  bus.on("count", (n: number) => calls.push("B" + n));
  const unC = bus.on("count", (n: number) => calls.push("C" + n));
  bus.emit("count", 1);
  unA();
  unA();
  unA();
  bus.emit("count", 2);
  unC();
  unC();
  bus.emit("count", 3);
  expect(calls).toEqual(["A1", "B1", "C1", "B2", "C2", "B3"]);

  const onceCalls: number[] = [];
  const unOnce = bus.once("count", (n: number) => onceCalls.push(n));
  const other: number[] = [];
  bus.on("count", (n: number) => other.push(n));
  bus.emit("count", 4);
  unOnce();
  unOnce();
  bus.emit("count", 5);
  expect(onceCalls).toEqual([4]);
  expect(other).toEqual([4, 5]);
});

it("unsubscribing from one event does not touch another event", () => {
  const bus = createTypedBus<Events>();
  let resets = 0;
  let counts = 0;
  const unReset = bus.on("reset", () => {
    resets++;
  });
  bus.on("count", () => {
    counts++;
  });
  unReset();
  unReset();
  bus.emit("reset");
  bus.emit("count", 1);
  expect(resets).toBe(0);
  expect(counts).toBe(1);
});

it("off removes a previously registered listener", () => {
  const bus = createTypedBus<Events>();
  const seen: number[] = [];
  const fn = (n: number): void => {
    seen.push(n);
  };
  bus.on("count", fn);
  bus.emit("count", 1);
  bus.off("count", fn);
  bus.emit("count", 2);
  expect(seen).toEqual([1]);
});

it("a listener removing itself during emit does not skip the others", () => {
  const bus = createTypedBus<Events>();
  const calls: string[] = [];
  const unA = bus.on("count", () => {
    calls.push("A");
    unA();
  });
  bus.on("count", () => calls.push("B"));
  bus.on("count", () => calls.push("C"));
  bus.emit("count", 1);
  expect(calls).toEqual(["A", "B", "C"]);
  bus.emit("count", 2);
  expect(calls).toEqual(["A", "B", "C", "B", "C"]);
});

it("a once listener firing during emit does not skip later listeners", () => {
  const bus = createTypedBus<Events>();
  const calls: string[] = [];
  bus.once("count", () => calls.push("once"));
  bus.on("count", () => calls.push("B"));
  bus.on("count", () => calls.push("C"));
  bus.emit("count", 1);
  expect(calls).toEqual(["once", "B", "C"]);
});

it("a listener added during emit does not disrupt existing listeners", () => {
  const bus = createTypedBus<Events>();
  const calls: string[] = [];
  let added = false;
  bus.on("count", () => {
    calls.push("A");
    if (!added) {
      added = true;
      bus.on("count", () => calls.push("late"));
    }
  });
  bus.on("count", () => calls.push("B"));
  bus.emit("count", 1);
  expect(calls.filter((c) => c === "A")).toHaveLength(1);
  expect(calls.filter((c) => c === "B")).toHaveLength(1);
  const before = calls.length;
  bus.emit("count", 2);
  expect(calls.slice(before)).toEqual(["A", "B", "late"]);
});

it("payload and void typing is enforced at compile time", () => {
  const bus = createTypedBus<Events>();
  const run = (fn: () => void): void => {
    try {
      fn();
    } catch {
      /* only the compile-time check matters */
    }
  };
  run(() => {
    // @ts-expect-error payload is required
    bus.emit("greet");
  });
  run(() => {
    // @ts-expect-error wrong payload type
    bus.emit("greet", { name: 5 });
  });
  run(() => {
    // @ts-expect-error wrong payload type
    bus.emit("count", "1");
  });
  run(() => {
    // @ts-expect-error unknown event
    bus.emit("nope", 1);
  });
  run(() => {
    // @ts-expect-error unknown event
    bus.on("nope", () => {});
  });
  run(() => {
    // @ts-expect-error listener parameter type must match the payload
    bus.on("count", (s: string) => s);
  });
  expect(true).toBe(true);
});

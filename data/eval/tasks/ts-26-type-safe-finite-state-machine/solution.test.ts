import { expect, it } from "vitest";
import { createStateMachine } from "./solution";

function door(open: { allowed: boolean }) {
  return createStateMachine({
    initial: "closed",
    transitions: {
      closed: { open: { target: "opened" }, lock: { target: "locked", guard: () => open.allowed } },
      opened: { close: { target: "closed" } },
      locked: { unlock: { target: "closed", guard: () => open.allowed } },
    },
  });
}

it("starts in the initial state and transitions on valid events", () => {
  const m = door({ allowed: true });
  expect(m.getState()).toBe("closed");
  expect(m.send("open")).toBe(true);
  expect(m.getState()).toBe("opened");
  expect(m.send("close")).toBe(true);
  expect(m.getState()).toBe("closed");
});

it("returns false and keeps state for events not valid in the current state", () => {
  const m = door({ allowed: true });
  expect(m.send("close")).toBe(false);
  expect(m.send("unlock")).toBe(false);
  expect(m.getState()).toBe("closed");
});

it("honours guards in send and can, without mutating state", () => {
  const flag = { allowed: false };
  const m = door(flag);
  expect(m.can("lock")).toBe(false);
  expect(m.send("lock")).toBe(false);
  expect(m.getState()).toBe("closed");
  flag.allowed = true;
  expect(m.can("lock")).toBe(true);
  expect(m.getState()).toBe("closed");
  expect(m.can("lock")).toBe(true);
  expect(m.send("lock")).toBe(true);
  expect(m.getState()).toBe("locked");
});

it("can reflects transition existence", () => {
  const m = door({ allowed: true });
  expect(m.can("open")).toBe(true);
  expect(m.can("close")).toBe(false);
  expect(m.getState()).toBe("closed");
});

it("guards are evaluated once per can/send call and only for the current state", () => {
  let calls = 0;
  const m = createStateMachine({
    initial: "a",
    transitions: {
      a: { go: { target: "b", guard: () => { calls++; return true; } } },
      b: { back: { target: "a" } },
    },
  });
  m.can("go");
  expect(m.getState()).toBe("a");
  m.send("go");
  expect(m.getState()).toBe("b");
  const before = calls;
  m.can("back");
  expect(calls).toBe(before);
});

it("rejects undeclared events and undeclared target states at compile time", () => {
  const m = door({ allowed: true });
  // @ts-expect-error "explode" is not a declared event
  m.send("explode");
  createStateMachine({
    initial: "a",
    transitions: {
      a: { go: { target: "b" } },
      // @ts-expect-error "nowhere" is not a declared state
      b: { go: { target: "nowhere" } },
    },
  });
});

// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SplitStoreProvider, useStoreActions, useUnreadCount, useUserName } from "./solution";

afterEach(cleanup);

const renders = { name: 0, count: 0, actions: 0 };
let actions!: ReturnType<typeof useStoreActions>;

function Name() {
  renders.name++;
  return <span data-testid="name">{useUserName()}</span>;
}
function Count() {
  renders.count++;
  return <span data-testid="count">{useUnreadCount()}</span>;
}
function Actions() {
  renders.actions++;
  actions = useStoreActions();
  return <button type="button">act</button>;
}

function setup() {
  renders.name = renders.count = renders.actions = 0;
  const tree = (
    <SplitStoreProvider initialUserName="ann" initialUnreadCount={0}>
      <Name />
      <Count />
      <Actions />
    </SplitStoreProvider>
  );
  render(tree);
}

it("incrementing the unread count re-renders only the count consumer", () => {
  setup();
  expect(renders).toEqual({ name: 1, count: 1, actions: 1 });
  act(() => actions.incrementUnread());
  expect(screen.getByTestId("count").textContent).toBe("1");
  act(() => actions.incrementUnread());
  expect(screen.getByTestId("count").textContent).toBe("2");
  expect(renders.count).toBe(3);
  expect(renders.name).toBe(1);
  expect(renders.actions).toBe(1);
});

it("changing the user name does not re-render the unread-count consumer", () => {
  setup();
  act(() => actions.setUserName("bob"));
  expect(screen.getByTestId("name").textContent).toBe("bob");
  expect(renders.name).toBe(2);
  expect(renders.count).toBe(1);
  expect(renders.actions).toBe(1);
});

it("every hook throws an Error outside the provider", () => {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  function A() { useUserName(); return null; }
  function B() { useUnreadCount(); return null; }
  function C() { useStoreActions(); return null; }
  expect(() => render(<A />)).toThrow(Error);
  expect(() => render(<B />)).toThrow(Error);
  expect(() => render(<C />)).toThrow(Error);
  spy.mockRestore();
});

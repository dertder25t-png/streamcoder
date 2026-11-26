// @vitest-environment jsdom
import { StrictMode, useEffect } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useExternalSnapshot } from "./solution";

afterEach(cleanup);

function makeStore(initial: number) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    listeners,
    set(v: number) {
      value = v;
      Array.from(listeners).forEach((l) => l());
    },
    subscribe(cb: () => void) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    getSnapshot: () => value,
  };
}
type TestStore = ReturnType<typeof makeStore>;

function View({ store }: { store: TestStore }) {
  const v = useExternalSnapshot<number>(store);
  return <span data-testid="v">{v}</span>;
}

it("reflects updates pushed by the store", () => {
  const store = makeStore(1);
  render(<View store={store} />);
  expect(screen.getByTestId("v").textContent).toBe("1");
  act(() => store.set(2));
  expect(screen.getByTestId("v").textContent).toBe("2");
});

it("does not miss a mutation made after render but before the subscription is set up", () => {
  const store = makeStore(1);
  function Mutator() {
    useEffect(() => {
      store.set(5);
    }, []);
    return null;
  }
  render(
    <>
      <Mutator />
      <View store={store} />
    </>,
  );
  expect(screen.getByTestId("v").textContent).toBe("5");
});

it("switches stores: unsubscribes from the old one and follows the new one", () => {
  const a = makeStore(1);
  const b = makeStore(100);
  const { rerender } = render(<View store={a} />);
  expect(a.listeners.size).toBe(1);
  rerender(<View store={b} />);
  expect(screen.getByTestId("v").textContent).toBe("100");
  expect(a.listeners.size).toBe(0);
  expect(b.listeners.size).toBe(1);
  act(() => a.set(2));
  expect(screen.getByTestId("v").textContent).toBe("100");
  act(() => b.set(101));
  expect(screen.getByTestId("v").textContent).toBe("101");
});

it("under StrictMode keeps exactly one subscription while mounted and none after unmount", () => {
  const store = makeStore(1);
  const { unmount } = render(
    <StrictMode>
      <View store={store} />
    </StrictMode>,
  );
  expect(store.listeners.size).toBe(1);
  act(() => store.set(3));
  expect(screen.getByTestId("v").textContent).toBe("3");
  unmount();
  expect(store.listeners.size).toBe(0);
});

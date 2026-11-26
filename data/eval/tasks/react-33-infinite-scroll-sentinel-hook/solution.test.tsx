// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useInfiniteScroll } from "./solution";

type Cb = (entries: Array<{ isIntersecting: boolean }>, obs: unknown) => void;
const instances: Array<{ cb: Cb; observed: Element[]; disconnected: boolean }> = [];

beforeEach(() => {
  instances.length = 0;
  class FakeIO {
    rec: { cb: Cb; observed: Element[]; disconnected: boolean };
    constructor(cb: Cb) {
      this.rec = { cb, observed: [], disconnected: false };
      instances.push(this.rec);
    }
    observe(el: Element) {
      this.rec.observed.push(el);
    }
    unobserve() {}
    disconnect() {
      this.rec.disconnected = true;
    }
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", FakeIO);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Sentinel({ onIntersect, show = true }: { onIntersect: () => void; show?: boolean }) {
  const ref = useInfiniteScroll(onIntersect);
  return show ? <div data-testid="s" ref={ref} /> : <div />;
}

const live = () => instances.filter((i) => !i.disconnected);

it("observes the element it is attached to", () => {
  const { getByTestId } = render(<Sentinel onIntersect={() => {}} />);
  expect(live().length).toBe(1);
  expect(live()[0].observed).toEqual([getByTestId("s")]);
});

it("calls onIntersect only when the sentinel is intersecting (latest callback)", () => {
  const a = vi.fn();
  const b = vi.fn();
  const { rerender } = render(<Sentinel onIntersect={a} />);
  live()[0].cb([{ isIntersecting: false }], {});
  expect(a).not.toHaveBeenCalled();
  rerender(<Sentinel onIntersect={b} />);
  live()[live().length - 1].cb([{ isIntersecting: true }], {});
  expect(a).not.toHaveBeenCalled();
  expect(b).toHaveBeenCalledTimes(1);
});

it("disconnects on unmount", () => {
  const { unmount } = render(<Sentinel onIntersect={() => {}} />);
  unmount();
  expect(live().length).toBe(0);
});

it("disconnects when the ref element is removed", () => {
  const { rerender } = render(<Sentinel onIntersect={() => {}} />);
  rerender(<Sentinel onIntersect={() => {}} show={false} />);
  expect(live().length).toBe(0);
});

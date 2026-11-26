// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { useClickOutside } from "./solution";

function Dropdown({ onOutside }: { onOutside: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onOutside);
  return (
    <div>
      <div ref={ref} data-testid="inside">
        <button>inner button</button>
      </div>
      <p data-testid="outside">outside</p>
    </div>
  );
}

afterEach(cleanup);

it("fires on mousedown and touchstart outside", () => {
  const handler = vi.fn();
  render(<Dropdown onOutside={handler} />);
  fireEvent.mouseDown(screen.getByTestId("outside"));
  fireEvent.touchStart(document.body);
  expect(handler).toHaveBeenCalledTimes(2);
});

it("does not fire for clicks inside, including nested children", () => {
  const handler = vi.fn();
  render(<Dropdown onOutside={handler} />);
  fireEvent.mouseDown(screen.getByTestId("inside"));
  fireEvent.mouseDown(screen.getByText("inner button"));
  fireEvent.touchStart(screen.getByText("inner button"));
  expect(handler).not.toHaveBeenCalled();
});

it("removes its listeners on unmount", () => {
  const handler = vi.fn();
  const remove = vi.spyOn(EventTarget.prototype, "removeEventListener");
  const { unmount } = render(<Dropdown onOutside={handler} />);
  unmount();
  const removed = remove.mock.calls.map((c) => c[0]);
  expect(removed).toContain("mousedown");
  expect(removed).toContain("touchstart");
  fireEvent.mouseDown(document.body);
  expect(handler).not.toHaveBeenCalled();
  remove.mockRestore();
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SwitchControl } from "./solution";

afterEach(cleanup);

const sw = () => screen.getByRole("switch");

it("uncontrolled: starts from defaultChecked ?? false and toggles with onChange(next)", () => {
  const onChange = vi.fn();
  const { unmount } = render(<SwitchControl onChange={onChange} />);
  expect(sw().getAttribute("aria-checked")).toBe("false");
  fireEvent.click(sw());
  expect(sw().getAttribute("aria-checked")).toBe("true");
  expect(onChange).toHaveBeenLastCalledWith(true);
  fireEvent.click(sw());
  expect(sw().getAttribute("aria-checked")).toBe("false");
  expect(onChange).toHaveBeenLastCalledWith(false);
  unmount();

  render(<SwitchControl defaultChecked onChange={onChange} />);
  expect(sw().getAttribute("aria-checked")).toBe("true");
  fireEvent.click(sw());
  expect(sw().getAttribute("aria-checked")).toBe("false");
  expect(onChange).toHaveBeenLastCalledWith(false);
});

it("controlled: reflects the prop and follows parent updates", () => {
  const { rerender } = render(<SwitchControl checked={false} />);
  expect(sw().getAttribute("aria-checked")).toBe("false");
  rerender(<SwitchControl checked={true} />);
  expect(sw().getAttribute("aria-checked")).toBe("true");
  rerender(<SwitchControl checked={false} />);
  expect(sw().getAttribute("aria-checked")).toBe("false");
});

it("controlled: clicking notifies but does not change until the parent updates", () => {
  const onChange = vi.fn();
  const { rerender } = render(<SwitchControl checked={false} onChange={onChange} />);
  fireEvent.click(sw());
  expect(onChange).toHaveBeenCalledWith(true);
  expect(sw().getAttribute("aria-checked")).toBe("false");
  rerender(<SwitchControl checked={true} onChange={onChange} />);
  expect(sw().getAttribute("aria-checked")).toBe("true");
});

it("controlled value wins over defaultChecked", () => {
  render(<SwitchControl checked={false} defaultChecked={true} />);
  expect(sw().getAttribute("aria-checked")).toBe("false");
});

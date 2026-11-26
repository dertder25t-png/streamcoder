// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SelectAllGroup } from "./solution";

afterEach(cleanup);

const options = [
  { id: "a", label: "Apple" },
  { id: "b", label: "Banana" },
  { id: "c", label: "Cherry" },
];

const master = () => screen.getByRole("checkbox", { name: /select all/i }) as HTMLInputElement;
const optionBoxes = () =>
  (screen.getAllByRole("checkbox") as HTMLInputElement[]).filter((b) => b !== master());
const sorted = (fn: ReturnType<typeof vi.fn>) => [...(fn.mock.calls.at(-1)?.[0] as string[])].sort();

it("master is indeterminate (and unchecked) when only some are selected", () => {
  const { rerender } = render(<SelectAllGroup options={options} selectedIds={["a"]} onChange={() => {}} />);
  expect(master().indeterminate).toBe(true);
  expect(master().checked).toBe(false);
  rerender(<SelectAllGroup options={options} selectedIds={[]} onChange={() => {}} />);
  expect(master().indeterminate).toBe(false);
  expect(master().checked).toBe(false);
  rerender(<SelectAllGroup options={options} selectedIds={["a", "b", "c"]} onChange={() => {}} />);
  expect(master().indeterminate).toBe(false);
  expect(master().checked).toBe(true);
});

it("clicking master selects everything when none or some are selected", () => {
  const onChange = vi.fn();
  const { rerender } = render(<SelectAllGroup options={options} selectedIds={[]} onChange={onChange} />);
  fireEvent.click(master());
  expect(sorted(onChange)).toEqual(["a", "b", "c"]);
  rerender(<SelectAllGroup options={options} selectedIds={["b"]} onChange={onChange} />);
  fireEvent.click(master());
  expect(sorted(onChange)).toEqual(["a", "b", "c"]);
});

it("clicking master when all are selected clears all", () => {
  const onChange = vi.fn();
  render(<SelectAllGroup options={options} selectedIds={["a", "b", "c"]} onChange={onChange} />);
  fireEvent.click(master());
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange.mock.calls[0][0]).toEqual([]);
});

it("individual checkboxes reflect selection and toggle their own id", () => {
  const onChange = vi.fn();
  render(<SelectAllGroup options={options} selectedIds={["b"]} onChange={onChange} />);
  const boxes = optionBoxes();
  expect(boxes.map((b) => b.checked)).toEqual([false, true, false]);
  fireEvent.click(boxes[0]);
  expect(sorted(onChange)).toEqual(["a", "b"]);
  fireEvent.click(boxes[1]);
  expect(sorted(onChange)).toEqual([]);
});

it("disabled options are never toggled by select all and do not block all-selected", () => {
  const onChange = vi.fn();
  const opts = [
    { id: "a", label: "Apple" },
    { id: "b", label: "Banana", disabled: true },
    { id: "c", label: "Cherry" },
  ];
  const { rerender } = render(<SelectAllGroup options={opts} selectedIds={[]} onChange={onChange} />);
  fireEvent.click(master());
  expect(sorted(onChange)).toEqual(["a", "c"]);

  rerender(<SelectAllGroup options={opts} selectedIds={["a", "c"]} onChange={onChange} />);
  expect(master().checked).toBe(true);
  expect(master().indeterminate).toBe(false);
  fireEvent.click(master());
  expect(sorted(onChange)).toEqual([]);
});

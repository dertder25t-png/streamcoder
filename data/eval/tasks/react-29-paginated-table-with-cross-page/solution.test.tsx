// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PaginatedSelectorTable } from "./solution";

afterEach(cleanup);

const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `r${i + 1}`, name: `Row ${i + 1}` }));
const last = (fn: ReturnType<typeof vi.fn>) => (fn.mock.calls[fn.mock.calls.length - 1][0] as string[]).slice().sort();
const box = (n: string) => screen.getByRole("checkbox", { name: n }) as HTMLInputElement;
const next = () => fireEvent.click(screen.getByRole("button", { name: /next/i }));
const prev = () => fireEvent.click(screen.getByRole("button", { name: /prev/i }));

it("keeps selections across pages and reports all selected ids", () => {
  const onSel = vi.fn();
  render(<PaginatedSelectorTable rows={mk(5)} pageSize={2} onSelectionChange={onSel} />);
  fireEvent.click(box("Select Row 1"));
  next();
  fireEvent.click(box("Select Row 3"));
  expect(last(onSel)).toEqual(["r1", "r3"]);
  prev();
  expect(box("Select Row 1").checked).toBe(true);
  expect(screen.getByRole("button", { name: "Clear all (2)" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /clear all/i }));
  expect(last(onSel)).toEqual([]);
  expect(box("Select Row 1").checked).toBe(false);
});

it("header checkbox only affects the visible page", () => {
  const onSel = vi.fn();
  render(<PaginatedSelectorTable rows={mk(5)} pageSize={2} onSelectionChange={onSel} />);
  fireEvent.click(box("Select Row 1"));
  next();
  const header = box("Select page");
  expect(header.checked).toBe(false);
  fireEvent.click(header);
  expect(header.checked).toBe(true);
  expect(last(onSel)).toEqual(["r1", "r3", "r4"]);
  fireEvent.click(header);
  expect(last(onSel)).toEqual(["r1"]);
});

it("clamps the page when rows shrink", () => {
  const { rerender } = render(<PaginatedSelectorTable rows={mk(5)} pageSize={2} onSelectionChange={() => {}} />);
  next();
  next();
  expect(screen.getByText("Row 5")).toBeTruthy();
  rerender(<PaginatedSelectorTable rows={mk(3)} pageSize={2} onSelectionChange={() => {}} />);
  expect(screen.getByText("Row 3")).toBeTruthy();
  expect(screen.queryByText("Row 5")).toBeNull();
});

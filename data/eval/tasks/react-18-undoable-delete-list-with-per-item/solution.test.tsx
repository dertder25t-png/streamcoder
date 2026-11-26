// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DeferredActionList } from "./solution";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const items = [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Beta" },
  { id: "c", label: "Gamma" },
];

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const deleteButtons = () => screen.getAllByRole("button", { name: /^delete\b/i });
const undoButtons = () => screen.getAllByRole("button", { name: /undo/i });

it("shows Deleting... and Undo, then commits after the grace period", () => {
  const onCommitDelete = vi.fn();
  render(<DeferredActionList items={items} onCommitDelete={onCommitDelete} graceMs={1000} />);
  fireEvent.click(deleteButtons()[0]);
  expect(screen.getByText(/deleting/i)).not.toBeNull();
  expect(undoButtons()).toHaveLength(1);
  advance(999);
  expect(onCommitDelete).not.toHaveBeenCalled();
  advance(1);
  expect(onCommitDelete).toHaveBeenCalledTimes(1);
  expect(onCommitDelete).toHaveBeenCalledWith("a");
  advance(10000);
  expect(onCommitDelete).toHaveBeenCalledTimes(1);
});

it("defaults to a 3000 ms grace period", () => {
  const onCommitDelete = vi.fn();
  render(<DeferredActionList items={items} onCommitDelete={onCommitDelete} />);
  fireEvent.click(deleteButtons()[1]);
  advance(2999);
  expect(onCommitDelete).not.toHaveBeenCalled();
  advance(1);
  expect(onCommitDelete).toHaveBeenCalledWith("b");
});

it("Undo cancels the deletion", () => {
  const onCommitDelete = vi.fn();
  render(<DeferredActionList items={items} onCommitDelete={onCommitDelete} graceMs={1000} />);
  fireEvent.click(deleteButtons()[0]);
  advance(500);
  fireEvent.click(undoButtons()[0]);
  advance(10000);
  expect(onCommitDelete).not.toHaveBeenCalled();
  expect(screen.queryByText(/deleting/i)).toBeNull();
  expect(deleteButtons()).toHaveLength(3);
});

it("each item has its own independent deadline", () => {
  const onCommitDelete = vi.fn();
  render(<DeferredActionList items={items} onCommitDelete={onCommitDelete} graceMs={3000} />);
  const dels = deleteButtons();
  fireEvent.click(dels[0]);
  advance(1000);
  fireEvent.click(dels[1]);
  expect(undoButtons()).toHaveLength(2);
  // undo the first one; the second keeps its original deadline
  fireEvent.click(undoButtons()[0]);
  advance(2999);
  expect(onCommitDelete).not.toHaveBeenCalled();
  advance(1);
  expect(onCommitDelete).toHaveBeenCalledTimes(1);
  expect(onCommitDelete).toHaveBeenCalledWith("b");
  advance(10000);
  expect(onCommitDelete).toHaveBeenCalledTimes(1);
});

it("a later deletion does not postpone or cancel an earlier one", () => {
  const onCommitDelete = vi.fn();
  render(<DeferredActionList items={items} onCommitDelete={onCommitDelete} graceMs={3000} />);
  const dels = deleteButtons();
  fireEvent.click(dels[0]);
  advance(2000);
  fireEvent.click(dels[1]);
  advance(1000);
  expect(onCommitDelete).toHaveBeenCalledTimes(1);
  expect(onCommitDelete).toHaveBeenLastCalledWith("a");
  advance(2000);
  expect(onCommitDelete).toHaveBeenCalledTimes(2);
  expect(onCommitDelete).toHaveBeenLastCalledWith("b");
});

it("invokes the latest onCommitDelete if it changed before the timer fired", () => {
  const first = vi.fn();
  const second = vi.fn();
  const { rerender } = render(<DeferredActionList items={items} onCommitDelete={first} graceMs={1000} />);
  fireEvent.click(deleteButtons()[0]);
  rerender(<DeferredActionList items={items} onCommitDelete={second} graceMs={1000} />);
  advance(1000);
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledWith("a");
});

it("externally removing a pending item cancels its deletion", () => {
  const onCommitDelete = vi.fn();
  const { rerender } = render(<DeferredActionList items={items} onCommitDelete={onCommitDelete} graceMs={1000} />);
  fireEvent.click(deleteButtons()[0]);
  fireEvent.click(deleteButtons()[0]);
  advance(500);
  rerender(<DeferredActionList items={items.filter((i) => i.id === "c")} onCommitDelete={onCommitDelete} graceMs={1000} />);
  advance(10000);
  expect(onCommitDelete).not.toHaveBeenCalled();
});

it("unmounting cancels pending deletions", () => {
  const onCommitDelete = vi.fn();
  const { unmount } = render(<DeferredActionList items={items} onCommitDelete={onCommitDelete} graceMs={1000} />);
  fireEvent.click(deleteButtons()[0]);
  unmount();
  advance(10000);
  expect(onCommitDelete).not.toHaveBeenCalled();
});

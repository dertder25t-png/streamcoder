// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { AccessibleModal } from "./solution";

afterEach(cleanup);

function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open settings
      </button>
      <AccessibleModal
        isOpen={open}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
        title="Settings"
      >
        <button type="button">First</button>
        <input aria-label="Name" />
        <button type="button">Last</button>
      </AccessibleModal>
    </div>
  );
}

function openModal() {
  const trigger = screen.getByRole("button", { name: "Open settings" });
  act(() => trigger.focus());
  fireEvent.click(trigger);
  return trigger;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const focusables = () =>
  Array.from(screen.getByRole("dialog").querySelectorAll<HTMLElement>(FOCUSABLE));
const pressTab = (shiftKey: boolean) =>
  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Tab", shiftKey });

it("renders nothing when closed", () => {
  render(<AccessibleModal isOpen={false} onClose={() => {}} title="Settings">hi</AccessibleModal>);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByText("Settings")).toBeNull();
});

it("renders an aria-modal dialog labelled by its title heading when open", () => {
  render(<Harness />);
  openModal();
  const dialog = screen.getByRole("dialog");
  expect(dialog.getAttribute("aria-modal")).toBe("true");
  const heading = screen.getByRole("heading", { name: "Settings" });
  expect(heading.id).not.toBe("");
  expect(dialog.getAttribute("aria-labelledby")).toBe(heading.id);
  expect(screen.getByRole("dialog", { name: "Settings" })).toBe(dialog);
});

it("moves focus into the dialog on open", () => {
  render(<Harness />);
  openModal();
  expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
});

it("Tab on the last focusable wraps to the first; Shift+Tab on the first wraps to the last", () => {
  render(<Harness />);
  openModal();
  const items = focusables();
  expect(items.length).toBeGreaterThanOrEqual(3);
  const first = items[0];
  const last = items[items.length - 1];
  act(() => last.focus());
  pressTab(false);
  expect(document.activeElement).toBe(first);
  pressTab(true);
  expect(document.activeElement).toBe(last);
});

it("Escape calls onClose and restores focus to the trigger", () => {
  const onClose = vi.fn();
  render(<Harness onClose={onClose} />);
  const trigger = openModal();
  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it("backdrop click calls onClose and restores focus; clicks inside do not close", () => {
  const onClose = vi.fn();
  render(<Harness onClose={onClose} />);
  const trigger = openModal();
  const dialog = screen.getByRole("dialog");
  fireEvent.click(screen.getByRole("button", { name: "First" }));
  fireEvent.click(dialog);
  expect(onClose).not.toHaveBeenCalled();

  const candidates = [dialog.parentElement, ...Array.from(dialog.parentElement?.children ?? []).filter((c) => c !== dialog)];
  for (const el of candidates) {
    if (onClose.mock.calls.length > 0) break;
    if (el) fireEvent.click(el);
  }
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

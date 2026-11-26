// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SubmitOnceButton } from "./solution";

afterEach(cleanup);

function deferred() {
  let resolve!: () => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const btn = () => screen.getByRole("button") as HTMLButtonElement;

it("two synchronous rapid clicks call onAction exactly once", async () => {
  const d = deferred();
  const onAction = vi.fn((): Promise<void> => d.promise);
  render(<SubmitOnceButton onAction={onAction} label="Save" />);
  act(() => {
    btn().click();
    btn().click();
  });
  expect(onAction).toHaveBeenCalledTimes(1);
  await act(async () => d.resolve());
  expect(onAction).toHaveBeenCalledTimes(1);
});

it("shows Working... and disables while pending, then restores on resolve", async () => {
  const d = deferred();
  const onAction = vi.fn((): Promise<void> => d.promise);
  render(<SubmitOnceButton onAction={onAction} label="Save" />);
  expect(btn().textContent).toBe("Save");
  expect(btn().disabled).toBe(false);
  act(() => btn().click());
  expect(btn().textContent).toBe("Working...");
  expect(btn().disabled).toBe(true);
  await act(async () => d.resolve());
  expect(btn().textContent).toBe("Save");
  expect(btn().disabled).toBe(false);
  act(() => btn().click());
  expect(onAction).toHaveBeenCalledTimes(2);
});

it("restores the label and can be used again after a rejection", async () => {
  const d = deferred();
  const onAction = vi.fn((): Promise<void> => d.promise);
  render(<SubmitOnceButton onAction={onAction} label="Save" />);
  act(() => btn().click());
  expect(btn().disabled).toBe(true);
  await act(async () => d.reject(new Error("nope")));
  expect(btn().textContent).toBe("Save");
  expect(btn().disabled).toBe(false);
  act(() => btn().click());
  expect(onAction).toHaveBeenCalledTimes(2);
});

it("does not blow up if unmounted before the promise settles", async () => {
  const d = deferred();
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const { unmount } = render(<SubmitOnceButton onAction={() => d.promise} label="Save" />);
  act(() => btn().click());
  unmount();
  await act(async () => d.resolve());
  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
});

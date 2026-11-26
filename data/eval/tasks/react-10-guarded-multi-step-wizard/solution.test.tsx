// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { StepWizard } from "./solution";

afterEach(cleanup);

const mk = (valid: (boolean | undefined)[]) =>
  valid.map((isValid, i) => ({ id: `s${i}`, title: `Step ${i + 1}`, content: <p>body {i + 1}</p>, isValid }));

const btn = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;
const maybe = (name: string) => screen.queryByRole("button", { name }) as HTMLButtonElement | null;

it("Back is disabled on the first step", () => {
  render(<StepWizard steps={mk([undefined, undefined, undefined])} onComplete={() => {}} />);
  expect(btn("Back").disabled).toBe(true);
  expect(btn("Next").disabled).toBe(false);
  expect(maybe("Finish")).toBeNull();
});

it("Next is disabled when the current step is invalid and enabled otherwise", () => {
  const { rerender } = render(<StepWizard steps={mk([false, undefined])} onComplete={() => {}} />);
  expect(btn("Next").disabled).toBe(true);
  fireEvent.click(btn("Next"));
  expect(btn("Back").disabled).toBe(true);
  rerender(<StepWizard steps={mk([true, undefined])} onComplete={() => {}} />);
  expect(btn("Next").disabled).toBe(false);
  fireEvent.click(btn("Next"));
  expect(btn("Back").disabled).toBe(false);
});

it("shows Finish on the last step and calls onComplete once", () => {
  const onComplete = vi.fn();
  render(<StepWizard steps={mk([undefined, true])} onComplete={onComplete} />);
  fireEvent.click(btn("Next"));
  expect(maybe("Next")).toBeNull();
  expect(btn("Finish").disabled).toBe(false);
  expect(onComplete).not.toHaveBeenCalled();
  fireEvent.click(btn("Finish"));
  expect(onComplete).toHaveBeenCalledTimes(1);
});

it("does not complete when the last step is invalid", () => {
  const onComplete = vi.fn();
  render(<StepWizard steps={mk([undefined, false])} onComplete={onComplete} />);
  fireEvent.click(btn("Next"));
  fireEvent.click(btn("Finish"));
  expect(onComplete).not.toHaveBeenCalled();
});

it("a single step shows Finish with Back disabled", () => {
  const onComplete = vi.fn();
  render(<StepWizard steps={mk([undefined])} onComplete={onComplete} />);
  expect(btn("Back").disabled).toBe(true);
  fireEvent.click(btn("Finish"));
  expect(onComplete).toHaveBeenCalledTimes(1);
});

it("navigation stays within bounds", () => {
  render(<StepWizard steps={mk([undefined, undefined, undefined])} onComplete={() => {}} />);
  fireEvent.click(btn("Back"));
  fireEvent.click(btn("Back"));
  expect(btn("Back").disabled).toBe(true);
  fireEvent.click(btn("Next"));
  fireEvent.click(btn("Next"));
  expect(maybe("Finish")).not.toBeNull();
  fireEvent.click(btn("Back"));
  expect(maybe("Next")).not.toBeNull();
  fireEvent.click(btn("Back"));
  expect(btn("Back").disabled).toBe(true);
  expect(maybe("Finish")).toBeNull();
});

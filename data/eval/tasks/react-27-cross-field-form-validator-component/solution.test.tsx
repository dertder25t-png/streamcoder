// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DateRangeForm } from "./solution";

afterEach(cleanup);

const start = () => screen.getByLabelText("Start date") as HTMLInputElement;
const end = () => screen.getByLabelText("End date") as HTMLInputElement;
const label = () => screen.getByLabelText("Label") as HTMLInputElement;
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const errorText = (el: HTMLElement) => {
  const ids = (el.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
  return ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ").trim();
};

it("hides errors until blur, then updates live", () => {
  render(<DateRangeForm onSubmit={() => {}} />);
  expect(errorText(label())).toBe("");
  fireEvent.blur(label());
  expect(errorText(label())).not.toBe("");
  type(label(), "Trip");
  expect(errorText(label())).toBe("");
});

it("validates end >= start and re-validates when start changes", () => {
  render(<DateRangeForm onSubmit={() => {}} />);
  type(start(), "2024-01-10");
  type(end(), "2024-01-05");
  fireEvent.blur(end());
  expect(errorText(end())).not.toBe("");
  type(start(), "2024-01-01");
  expect(errorText(end())).toBe("");
  type(start(), "2024-02-01");
  expect(errorText(end())).not.toBe("");
});

it("invalid submit blocks onSubmit, shows linked errors and focuses the first invalid input", () => {
  const onSubmit = vi.fn();
  render(<DateRangeForm onSubmit={onSubmit} />);
  type(start(), "2024-03-10");
  type(end(), "2024-03-01");
  fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(onSubmit).not.toHaveBeenCalled();
  expect(errorText(end())).not.toBe("");
  expect(errorText(label())).not.toBe("");
  expect(document.activeElement).toBe(end());
});

it("valid submit calls onSubmit", () => {
  const onSubmit = vi.fn();
  render(<DateRangeForm onSubmit={onSubmit} />);
  type(start(), "2024-03-01");
  type(end(), "2024-03-10");
  type(label(), "Trip");
  fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(onSubmit).toHaveBeenCalledTimes(1);
});

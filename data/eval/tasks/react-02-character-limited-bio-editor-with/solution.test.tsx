// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LimitedTextArea } from "./solution";

afterEach(cleanup);

function type(text: string) {
  fireEvent.change(screen.getByRole("textbox"), { target: { value: text } });
}

it("shows the remaining characters, including negative counts", () => {
  render(<LimitedTextArea maxLength={10} warnAt={3} onSubmit={() => {}} />);
  expect(screen.getByText("10 characters left")).toBeTruthy();
  type("abcd");
  expect(screen.getByText("6 characters left")).toBeTruthy();
  type("abcdefghijklm");
  expect(screen.getByText("-3 characters left")).toBeTruthy();
});

it("sets data-state to warning at or below warnAt and error below zero", () => {
  render(<LimitedTextArea maxLength={10} warnAt={3} onSubmit={() => {}} />);
  const counter = () => screen.getByText(/characters left/);
  type("abcdef"); // 4 left
  expect(counter().getAttribute("data-state")).not.toBe("warning");
  expect(counter().getAttribute("data-state")).not.toBe("error");
  type("abcdefg"); // 3 left
  expect(counter().getAttribute("data-state")).toBe("warning");
  type("abcdefghij"); // 0 left
  expect(counter().getAttribute("data-state")).toBe("warning");
  type("abcdefghijk"); // -1 left
  expect(counter().getAttribute("data-state")).toBe("error");
});

it("disables submit for empty, whitespace-only, and over-limit text", () => {
  render(<LimitedTextArea maxLength={5} warnAt={2} onSubmit={() => {}} />);
  const btn = screen.getByRole("button") as HTMLButtonElement;
  expect(btn.disabled).toBe(true);
  type("   ");
  expect(btn.disabled).toBe(true);
  type("abcdef");
  expect(btn.disabled).toBe(true);
  type("abcde");
  expect(btn.disabled).toBe(false);
});

it("calls onSubmit with the value", () => {
  const onSubmit = vi.fn();
  render(<LimitedTextArea maxLength={20} warnAt={5} onSubmit={onSubmit} />);
  type("hello bio");
  fireEvent.click(screen.getByRole("button"));
  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(onSubmit).toHaveBeenCalledWith("hello bio");
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PasswordPolicyMeter } from "./solution";

afterEach(cleanup);

// Rules are listed in the order: length >= 10, uppercase, digit, symbol.
function setup() {
  const onValidChange = vi.fn();
  const { container } = render(<PasswordPolicyMeter onValidChange={onValidChange} />);
  const input = container.querySelector("input") as HTMLInputElement;
  const type = (v: string) => fireEvent.change(input, { target: { value: v } });
  const passed = () =>
    Array.from(container.querySelectorAll("[data-passed]")).map((el) => el.getAttribute("data-passed"));
  return { onValidChange, type, passed };
}

it("renders four rules, all failing for an empty password", () => {
  const { passed } = setup();
  expect(passed()).toEqual(["false", "false", "false", "false"]);
});

it("updates each rule immediately", () => {
  const { type, passed } = setup();
  type("abcdefghijk");
  expect(passed()).toEqual(["true", "false", "false", "false"]);
  type("Abc");
  expect(passed()).toEqual(["false", "true", "false", "false"]);
  type("A1");
  expect(passed()).toEqual(["false", "true", "true", "false"]);
  type("a!");
  expect(passed()).toEqual(["false", "false", "false", "true"]);
  type("Abcdefghi1!");
  expect(passed()).toEqual(["true", "true", "true", "true"]);
});

it("does not count whitespace as a symbol", () => {
  const { type, passed } = setup();
  type("Abcdefghi1 ");
  expect(passed()).toEqual(["true", "true", "true", "false"]);
  type("Abcdefghi1\t");
  expect(passed()[3]).toBe("false");
});

it("calls onValidChange only when validity transitions", () => {
  const { onValidChange, type } = setup();
  type("a");
  type("ab");
  type("Abcdefghi1");
  onValidChange.mockClear();
  type("Abcdefghi1!");
  expect(onValidChange.mock.calls).toEqual([[true]]);
  type("Abcdefghi1!!");
  type("Abcdefghi1!!!");
  expect(onValidChange.mock.calls).toEqual([[true]]);
  type("Abc");
  expect(onValidChange.mock.calls).toEqual([[true], [false]]);
  type("Abcd");
  expect(onValidChange.mock.calls).toEqual([[true], [false]]);
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { TemperaturePair } from "./solution";

afterEach(cleanup);

const celsius = () => screen.getByLabelText(/celsius/i) as HTMLInputElement;
const fahrenheit = () => screen.getByLabelText(/fahrenheit/i) as HTMLInputElement;
const type = (el: HTMLInputElement, v: string) => fireEvent.change(el, { target: { value: v } });

it("converts Celsius to Fahrenheit and back", () => {
  render(<TemperaturePair />);
  type(celsius(), "0");
  expect(fahrenheit().value).toBe("32");
  type(fahrenheit(), "212");
  expect(celsius().value).toBe("100");
  expect(fahrenheit().value).toBe("212");
});

it("rounds to at most 2 decimals", () => {
  render(<TemperaturePair />);
  type(fahrenheit(), "100");
  expect(celsius().value).toBe("37.78");
  type(celsius(), "1");
  expect(fahrenheit().value).toBe("33.8");
});

it("keeps raw text for an incomplete '-' and clears the other field", () => {
  render(<TemperaturePair />);
  type(celsius(), "10");
  expect(fahrenheit().value).toBe("50");
  type(celsius(), "-");
  expect(celsius().value).toBe("-");
  expect(fahrenheit().value).toBe("");
  expect(document.body.textContent).not.toContain("NaN");
  expect((fahrenheit().value)).not.toMatch(/NaN/);
});

it("clearing a field clears the other without NaN", () => {
  render(<TemperaturePair />);
  type(fahrenheit(), "50");
  expect(celsius().value).toBe("10");
  type(fahrenheit(), "");
  expect(fahrenheit().value).toBe("");
  expect(celsius().value).toBe("");
});

it("does not reformat the field being edited", () => {
  render(<TemperaturePair />);
  type(celsius(), "20.");
  expect(celsius().value).toBe("20.");
  expect(fahrenheit().value).toBe("68");
  type(fahrenheit(), "68.0");
  expect(fahrenheit().value).toBe("68.0");
  expect(celsius().value).toBe("20");
});

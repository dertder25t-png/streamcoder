// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { TagChipsInput } from "./solution";

afterEach(cleanup);

function Harness({ initial = [], spy }: { initial?: string[]; spy: (next: string[]) => void }) {
  const [tags, setTags] = useState<string[]>(initial);
  return (
    <TagChipsInput
      value={tags}
      onChange={(next) => {
        spy(next);
        setTags(next);
      }}
    />
  );
}

const input = () => screen.getByRole("textbox") as HTMLInputElement;
const setText = (v: string) => fireEvent.change(input(), { target: { value: v } });
const enter = () => fireEvent.keyDown(input(), { key: "Enter" });
const lastCall = (spy: ReturnType<typeof vi.fn>) => spy.mock.calls[spy.mock.calls.length - 1][0];

afterEach(() => vi.restoreAllMocks());

it("commits a trimmed tag on Enter and clears the input", () => {
  const spy = vi.fn();
  render(<Harness spy={spy} />);
  setText("  react  ");
  enter();
  expect(lastCall(spy)).toEqual(["react"]);
  expect(input().value).toBe("");
  setText("node");
  enter();
  expect(lastCall(spy)).toEqual(["react", "node"]);
});

it("commits on comma", () => {
  const spy = vi.fn();
  render(<Harness spy={spy} />);
  setText("alpha");
  fireEvent.keyDown(input(), { key: "," });
  if (spy.mock.calls.length === 0) setText("alpha,");
  expect(lastCall(spy)).toEqual(["alpha"]);
  expect(input().value).toBe("");
});

it("ignores empty and case-insensitive duplicate tags", () => {
  const spy = vi.fn();
  render(<Harness initial={["React"]} spy={spy} />);
  setText("   ");
  enter();
  setText("react");
  enter();
  setText("REACT");
  enter();
  expect(spy).not.toHaveBeenCalled();
});

it("removes the last tag on Backspace only when the input is empty", () => {
  const spy = vi.fn();
  render(<Harness initial={["a", "b", "c"]} spy={spy} />);
  setText("x");
  fireEvent.keyDown(input(), { key: "Backspace" });
  expect(spy).not.toHaveBeenCalled();
  setText("");
  fireEvent.keyDown(input(), { key: "Backspace" });
  expect(lastCall(spy)).toEqual(["a", "b"]);
});

it("removes only the chosen tag with its remove button", () => {
  const spy = vi.fn();
  render(<Harness initial={["a", "b", "c"]} spy={spy} />);
  fireEvent.click(screen.getByRole("button", { name: "Remove b" }));
  expect(lastCall(spy)).toEqual(["a", "c"]);
  expect(screen.queryByRole("button", { name: "Remove b" })).toBeNull();
  expect(screen.getByRole("button", { name: "Remove a" })).toBeTruthy();
});

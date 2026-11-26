// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { AccordionGroup } from "./solution";

afterEach(cleanup);

const items = [
  { id: "a", title: "Alpha", content: "alpha body" },
  { id: "b", title: "Beta", content: "beta body" },
  { id: "c", title: "Gamma", content: "gamma body" },
];

const trigger = (name: string) => screen.getByRole("button", { name });
const expanded = (name: string) => trigger(name).getAttribute("aria-expanded");
// A panel counts as visible when it is in the DOM, not inside a [hidden] ancestor,
// and no ancestor has display:none (any common hiding technique is accepted).
const visible = (text: string) => {
  const el = screen.queryByText(text);
  if (!el || el.closest("[hidden]")) return false;
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    if (getComputedStyle(n).display === "none") return false;
  }
  return true;
};

it("starts collapsed", () => {
  render(<AccordionGroup items={items} />);
  for (const t of ["Alpha", "Beta", "Gamma"]) expect(expanded(t)).toBe("false");
  expect(visible("alpha body")).toBe(false);
});

it("single mode: opening one closes the other; clicking the open one closes it", () => {
  render(<AccordionGroup items={items} />);
  fireEvent.click(trigger("Alpha"));
  expect(expanded("Alpha")).toBe("true");
  expect(visible("alpha body")).toBe(true);
  fireEvent.click(trigger("Beta"));
  expect(expanded("Alpha")).toBe("false");
  expect(expanded("Beta")).toBe("true");
  expect(visible("alpha body")).toBe(false);
  expect(visible("beta body")).toBe(true);
  fireEvent.click(trigger("Beta"));
  expect(expanded("Beta")).toBe("false");
  expect(visible("beta body")).toBe(false);
});

it("allowMultiple keeps several panels open", () => {
  render(<AccordionGroup items={items} allowMultiple />);
  fireEvent.click(trigger("Alpha"));
  fireEvent.click(trigger("Gamma"));
  expect(expanded("Alpha")).toBe("true");
  expect(expanded("Gamma")).toBe("true");
  expect(expanded("Beta")).toBe("false");
  expect(visible("alpha body")).toBe(true);
  expect(visible("gamma body")).toBe(true);
  fireEvent.click(trigger("Alpha"));
  expect(expanded("Alpha")).toBe("false");
  expect(expanded("Gamma")).toBe("true");
});

it("aria-controls links each open trigger to its own panel", () => {
  render(<AccordionGroup items={items} />);
  fireEvent.click(trigger("Beta"));
  const id = trigger("Beta").getAttribute("aria-controls");
  expect(id).toBeTruthy();
  const panel = document.getElementById(id as string);
  expect(panel).not.toBeNull();
  expect(panel!.textContent).toContain("beta body");
  const ids = ["Alpha", "Beta", "Gamma"].map((t) => trigger(t).getAttribute("aria-controls"));
  expect(new Set(ids).size).toBe(3);
});

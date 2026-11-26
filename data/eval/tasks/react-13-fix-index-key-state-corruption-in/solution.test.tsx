// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { PriorityQueueList } from "./solution";

afterEach(cleanup);

const items = [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Beta" },
  { id: "c", label: "Gamma" },
];

const labels = () => screen.getAllByText(/^(Alpha|Beta|Gamma)$/).map((n) => n.textContent);
const drafts = () => screen.getAllByRole("textbox").map((n) => (n as HTMLInputElement).value);
const ups = () => screen.getAllByRole("button", { name: /move up/i }) as HTMLButtonElement[];
const downs = () => screen.getAllByRole("button", { name: /move down/i }) as HTMLButtonElement[];
const dels = () => screen.getAllByRole("button", { name: /delete/i });

function typeAll() {
  const boxes = screen.getAllByRole("textbox");
  fireEvent.change(boxes[0], { target: { value: "note-a" } });
  fireEvent.change(boxes[1], { target: { value: "note-b" } });
  fireEvent.change(boxes[2], { target: { value: "note-c" } });
}

it("moving an item moves its label and its draft together", () => {
  render(<PriorityQueueList items={items} />);
  typeAll();
  fireEvent.click(downs()[0]);
  expect(labels()).toEqual(["Beta", "Alpha", "Gamma"]);
  expect(drafts()).toEqual(["note-b", "note-a", "note-c"]);
  fireEvent.click(ups()[2]);
  expect(labels()).toEqual(["Beta", "Gamma", "Alpha"]);
  expect(drafts()).toEqual(["note-b", "note-c", "note-a"]);
});

it("Move Up is disabled on the first row, Move Down on the last", () => {
  render(<PriorityQueueList items={items} />);
  expect(ups()[0].disabled).toBe(true);
  expect(ups()[1].disabled).toBe(false);
  expect(downs()[2].disabled).toBe(true);
  expect(downs()[1].disabled).toBe(false);
  fireEvent.click(downs()[0]);
  fireEvent.click(downs()[1]);
  expect(labels()).toEqual(["Beta", "Gamma", "Alpha"]);
  expect(ups()[0].disabled).toBe(true);
  expect(downs()[2].disabled).toBe(true);
  expect(downs()[0].disabled).toBe(false);
});

it("deleting a row removes its draft without shifting comments", () => {
  render(<PriorityQueueList items={items} />);
  typeAll();
  fireEvent.click(dels()[1]);
  expect(labels()).toEqual(["Alpha", "Gamma"]);
  expect(drafts()).toEqual(["note-a", "note-c"]);
  fireEvent.click(dels()[0]);
  expect(labels()).toEqual(["Gamma"]);
  expect(drafts()).toEqual(["note-c"]);
});

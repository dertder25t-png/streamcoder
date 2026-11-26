// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SortableTable } from "./solution";

afterEach(cleanup);

const columns = [
  { key: "name", label: "Name" },
  { key: "score", label: "Score", numeric: true },
];
const makeRows = () => [
  { name: "carol", score: 100 },
  { name: "alice", score: 9 },
  { name: "bob", score: 10 },
];

const names = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((r: HTMLElement) => r.querySelectorAll("td")[0].textContent);
const header = (label: string) => screen.getByRole("columnheader", { name: label });
const click = (label: string) => fireEvent.click(screen.getByText(label));

it("renders header labels and rows in original order", () => {
  render(<SortableTable rows={makeRows()} columns={columns} />);
  expect(header("Name")).toBeTruthy();
  expect(header("Score")).toBeTruthy();
  expect(names()).toEqual(["carol", "alice", "bob"]);
  expect(header("Name").getAttribute("aria-sort")).toBe("none");
});

it("cycles ascending -> descending -> original order and updates aria-sort", () => {
  render(<SortableTable rows={makeRows()} columns={columns} />);
  click("Name");
  expect(names()).toEqual(["alice", "bob", "carol"]);
  expect(header("Name").getAttribute("aria-sort")).toBe("ascending");
  click("Name");
  expect(names()).toEqual(["carol", "bob", "alice"]);
  expect(header("Name").getAttribute("aria-sort")).toBe("descending");
  click("Name");
  expect(names()).toEqual(["carol", "alice", "bob"]);
  expect(header("Name").getAttribute("aria-sort")).toBe("none");
});

it("clicking another column starts it ascending and resets the previous one", () => {
  render(<SortableTable rows={makeRows()} columns={columns} />);
  click("Name");
  click("Name");
  click("Score");
  expect(names()).toEqual(["alice", "bob", "carol"]);
  expect(header("Score").getAttribute("aria-sort")).toBe("ascending");
  expect(header("Name").getAttribute("aria-sort")).toBe("none");
});

it("sorts numeric columns numerically", () => {
  render(<SortableTable rows={makeRows()} columns={columns} />);
  click("Score");
  expect(names()).toEqual(["alice", "bob", "carol"]); // 9, 10, 100
  click("Score");
  expect(names()).toEqual(["carol", "bob", "alice"]); // 100, 10, 9
});

it("never mutates the rows prop", () => {
  const rows = makeRows();
  const snapshot = JSON.stringify(rows);
  render(<SortableTable rows={rows} columns={columns} />);
  click("Name");
  click("Score");
  click("Score");
  expect(JSON.stringify(rows)).toBe(snapshot);
});

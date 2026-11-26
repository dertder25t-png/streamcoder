import { expect, it } from "vitest";
import { buildCategoryPath } from "./solution";

type Node = { id: string; parentId: string | null; name: string };

const tree: Node[] = [
  { id: "shoes", parentId: "apparel", name: "Shoes" },
  { id: "root", parentId: null, name: "Everything" },
  { id: "apparel", parentId: "root", name: "Apparel" },
  { id: "boots", parentId: "shoes", name: "Boots" },
  { id: "books", parentId: "root", name: "Books" },
];

it("returns names from root down to the target", () => {
  expect(buildCategoryPath(tree, "boots")).toEqual(["Everything", "Apparel", "Shoes", "Boots"]);
  expect(buildCategoryPath(tree, "books")).toEqual(["Everything", "Books"]);
  expect(buildCategoryPath(tree, "root")).toEqual(["Everything"]);
});

it("returns [] when the target does not exist", () => {
  expect(buildCategoryPath(tree, "nope")).toEqual([]);
  expect(buildCategoryPath([], "root")).toEqual([]);
});

it("does not mutate the input", () => {
  const copy = JSON.parse(JSON.stringify(tree)) as Node[];
  buildCategoryPath(tree, "boots");
  expect(tree).toEqual(copy);
});

it("throws an Error on circular parent chains", () => {
  const two: Node[] = [
    { id: "A", parentId: "B", name: "a" },
    { id: "B", parentId: "A", name: "b" },
  ];
  expect(() => buildCategoryPath(two, "A")).toThrow(Error);
  expect(() => buildCategoryPath(two, "B")).toThrow(Error);
  const self: Node[] = [{ id: "S", parentId: "S", name: "s" }];
  expect(() => buildCategoryPath(self, "S")).toThrow(Error);
  const tail: Node[] = [
    { id: "R", parentId: "A", name: "r" },
    { id: "A", parentId: "B", name: "a" },
    { id: "B", parentId: "C", name: "b" },
    { id: "C", parentId: "A", name: "c" },
  ];
  expect(() => buildCategoryPath(tail, "R")).toThrow(Error);
});

it("returns the partial path when an ancestor is missing", () => {
  const orphan: Node[] = [
    { id: "x", parentId: "ghost", name: "X" },
    { id: "y", parentId: "x", name: "Y" },
    { id: "z", parentId: "y", name: "Z" },
  ];
  expect(buildCategoryPath(orphan, "z")).toEqual(["X", "Y", "Z"]);
  expect(buildCategoryPath(orphan, "x")).toEqual(["X"]);
});

it("handles a deep chain", () => {
  const deep: Node[] = [];
  for (let i = 0; i < 2000; i++) deep.push({ id: `n${i}`, parentId: i === 0 ? null : `n${i - 1}`, name: `N${i}` });
  const path = buildCategoryPath(deep, "n1999");
  expect(path).toHaveLength(2000);
  expect(path[0]).toBe("N0");
  expect(path[1999]).toBe("N1999");
});

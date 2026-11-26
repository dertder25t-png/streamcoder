import { expect, it } from "vitest";
import { flattenTree, rebuildTree } from "./solution";

type TNode = { id: string; value: number; children: TNode[] };
type FNode = { id: string; parentId: string | null; value: number };

const deepFreeze = <X>(x: X): X => {
  if (x && typeof x === "object") {
    Object.freeze(x);
    for (const v of Object.values(x as object)) deepFreeze(v);
  }
  return x;
};

const forest = (): TNode[] => [
  {
    id: "a", value: 1,
    children: [
      { id: "a1", value: 11, children: [{ id: "a1x", value: 111, children: [] }] },
      { id: "a2", value: 12, children: [] },
    ],
  },
  { id: "b", value: 2, children: [] },
  { id: "c", value: 3, children: [{ id: "c1", value: 31, children: [] }] },
];

it("flattenTree emits depth-first pre-order with parentId and null for roots", () => {
  expect(flattenTree(forest())).toEqual([
    { id: "a", parentId: null, value: 1 },
    { id: "a1", parentId: "a", value: 11 },
    { id: "a1x", parentId: "a1", value: 111 },
    { id: "a2", parentId: "a", value: 12 },
    { id: "b", parentId: null, value: 2 },
    { id: "c", parentId: null, value: 3 },
    { id: "c1", parentId: "c", value: 31 },
  ]);
  expect(flattenTree([] as TNode[])).toEqual([]);
});

it("rebuildTree(flattenTree(forest)) equals the forest, without mutating inputs", () => {
  const f = deepFreeze(forest());
  const flat = flattenTree(f);
  deepFreeze(flat);
  expect(rebuildTree(flat)).toEqual(forest());
  expect(rebuildTree([] as FNode[])).toEqual([]);
});

it("rebuildTree works when children come before parents and keeps array order", () => {
  const flat: FNode[] = [
    { id: "x2", parentId: "x", value: 22 },
    { id: "y", parentId: null, value: 5 },
    { id: "x1", parentId: "x", value: 21 },
    { id: "x", parentId: null, value: 20 },
    { id: "x11", parentId: "x1", value: 211 },
  ];
  expect(rebuildTree(flat)).toEqual([
    { id: "y", value: 5, children: [] },
    {
      id: "x", value: 20,
      children: [
        { id: "x2", value: 22, children: [] },
        { id: "x1", value: 21, children: [{ id: "x11", value: 211, children: [] }] },
      ],
    },
  ]);
});

it("rebuildTree throws on duplicate ids and orphan parent references", () => {
  expect(() => rebuildTree<number>([
    { id: "a", parentId: null, value: 1 },
    { id: "a", parentId: null, value: 2 },
  ])).toThrow(Error);
  expect(() => rebuildTree<number>([
    { id: "a", parentId: null, value: 1 },
    { id: "b", parentId: "zzz", value: 2 },
  ])).toThrow(Error);
});

import { expect, it } from "vitest";
import { sortRecordsByKeys } from "./solution";

interface Row { id: number; team: string; score: number; active: boolean }
const rows: Row[] = [
  { id: 1, team: "b", score: 10, active: true },
  { id: 2, team: "a", score: 20, active: false },
  { id: 3, team: "b", score: 30, active: false },
  { id: 4, team: "a", score: 20, active: true },
  { id: 5, team: "a", score: 5, active: true },
];

it("returns a new array and leaves the input untouched", () => {
  const input = Object.freeze(rows.slice());
  const out = sortRecordsByKeys(input, [{ key: "score" }]);
  expect(out).not.toBe(input);
  expect(input.map((r) => r.id)).toEqual([1, 2, 3, 4, 5]);
  expect(out.map((r) => r.id)).toEqual([5, 1, 2, 4, 3]);
});

it("defaults to ascending and supports descending", () => {
  expect(sortRecordsByKeys(rows, [{ key: "team" }, { key: "score" }]).map((r) => r.id)).toEqual([5, 2, 4, 1, 3]);
  expect(sortRecordsByKeys(rows, [{ key: "score", direction: "desc" }]).map((r) => r.id)).toEqual([3, 2, 4, 1, 5]);
});

it("breaks ties with secondary keys using independent directions", () => {
  const out = sortRecordsByKeys(rows, [
    { key: "team", direction: "asc" },
    { key: "score", direction: "desc" },
    { key: "id", direction: "desc" },
  ]);
  expect(out.map((r) => r.id)).toEqual([4, 2, 5, 3, 1]);
  const out2 = sortRecordsByKeys(rows, [
    { key: "team", direction: "desc" },
    { key: "score", direction: "asc" },
  ]);
  expect(out2.map((r) => r.id)).toEqual([1, 3, 5, 2, 4]);
});

it("sorts booleans with false before true ascending", () => {
  expect(sortRecordsByKeys(rows, [{ key: "active" }]).map((r) => r.id)).toEqual([2, 3, 1, 4, 5]);
  expect(sortRecordsByKeys(rows, [{ key: "active", direction: "desc" }]).map((r) => r.id)).toEqual([1, 4, 5, 2, 3]);
});

it("is stable for records equal across all keys, also when descending", () => {
  const many = Array.from({ length: 40 }, (_, i) => ({ i, g: i % 2 }));
  expect(sortRecordsByKeys(many, [{ key: "g" }]).map((r) => r.i)).toEqual([
    ...many.filter((r) => r.g === 0).map((r) => r.i),
    ...many.filter((r) => r.g === 1).map((r) => r.i),
  ]);
  expect(sortRecordsByKeys(many, [{ key: "g", direction: "desc" }]).map((r) => r.i)).toEqual([
    ...many.filter((r) => r.g === 1).map((r) => r.i),
    ...many.filter((r) => r.g === 0).map((r) => r.i),
  ]);
  expect(sortRecordsByKeys(many, []).map((r) => r.i)).toEqual(many.map((r) => r.i));
});

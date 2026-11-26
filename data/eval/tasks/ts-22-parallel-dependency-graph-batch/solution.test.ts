import { expect, it } from "vitest";
import { planExecutionBatches } from "./solution";

it("builds the minimum number of waves, sorted within each wave", () => {
  expect(
    planExecutionBatches([
      { id: "deploy", dependsOn: ["test", "build"] },
      { id: "build", dependsOn: ["install"] },
      { id: "lint", dependsOn: ["install"] },
      { id: "test", dependsOn: ["build"] },
      { id: "install", dependsOn: [] },
      { id: "docs", dependsOn: [] },
    ]),
  ).toEqual([["docs", "install"], ["build", "lint"], ["test"], ["deploy"]]);
});

it("handles empty input and independent tasks", () => {
  expect(planExecutionBatches([])).toEqual([]);
  expect(planExecutionBatches([{ id: "b", dependsOn: [] }, { id: "a", dependsOn: [] }])).toEqual([["a", "b"]]);
});

it("throws on missing dependencies and duplicate ids", () => {
  expect(() => planExecutionBatches([{ id: "a", dependsOn: ["ghost"] }])).toThrow(Error);
  expect(() => planExecutionBatches([{ id: "a", dependsOn: [] }, { id: "a", dependsOn: [] }])).toThrow(Error);
});

it("throws on cycles and names a task in the cycle", () => {
  const run = () =>
    planExecutionBatches([
      { id: "ok", dependsOn: [] },
      { id: "x", dependsOn: ["y"] },
      { id: "y", dependsOn: ["z"] },
      { id: "z", dependsOn: ["x"] },
    ]);
  expect(run).toThrow(/\b(x|y|z)\b/);
});

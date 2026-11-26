import { expect, it } from "vitest";
import { expandWeekdaySpec } from "./solution";

it("expands single days and normal ranges", () => {
  expect(expandWeekdaySpec("Mon")).toEqual(["Mon"]);
  expect(expandWeekdaySpec("Tue-Thu")).toEqual(["Tue", "Wed", "Thu"]);
  expect(expandWeekdaySpec("Mon-Wed,Fri")).toEqual(["Mon", "Tue", "Wed", "Fri"]);
  expect(expandWeekdaySpec("Mon-Sun")).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
});

it("expands wrap-around ranges", () => {
  expect(expandWeekdaySpec("Sat-Mon")).toEqual(["Mon", "Sat", "Sun"]);
  expect(expandWeekdaySpec("Fri-Mon")).toEqual(["Mon", "Fri", "Sat", "Sun"]);
  expect(expandWeekdaySpec("Sun-Tue")).toEqual(["Mon", "Tue", "Sun"]);
});

it("is case-insensitive and returns canonical names", () => {
  expect(expandWeekdaySpec("mon-WED,fRi")).toEqual(["Mon", "Tue", "Wed", "Fri"]);
  expect(expandWeekdaySpec("SUN")).toEqual(["Sun"]);
});

it("deduplicates overlapping segments and sorts Mon to Sun", () => {
  expect(expandWeekdaySpec("Fri,Mon,Fri")).toEqual(["Mon", "Fri"]);
  expect(expandWeekdaySpec("Mon-Wed,Tue-Thu")).toEqual(["Mon", "Tue", "Wed", "Thu"]);
  expect(expandWeekdaySpec("Sun,Sat,Mon-Tue")).toEqual(["Mon", "Tue", "Sat", "Sun"]);
  expect(expandWeekdaySpec("Fri-Mon,Sat")).toEqual(["Mon", "Fri", "Sat", "Sun"]);
});

it("throws an Error on unknown tokens, empty specs and malformed ranges", () => {
  for (const bad of ["", "Funday", "Mon,Xyz", "Mon-", "-Mon", "Mon-Foo", "Mon-Tue-Wed", "Monday"]) {
    expect(() => expandWeekdaySpec(bad), JSON.stringify(bad)).toThrow(Error);
  }
});

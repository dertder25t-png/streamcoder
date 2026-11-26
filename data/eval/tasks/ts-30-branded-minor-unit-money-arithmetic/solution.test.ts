import { expect, it } from "vitest";
import { addMoney, allocateMoney, money } from "./solution";

it("money builds a value with minorUnits and currency", () => {
  const m = money(250, "USD");
  expect(m.minorUnits).toBe(250);
  expect(m.currency).toBe("USD");
});

it("addMoney adds same-currency amounts", () => {
  const r = addMoney(money(100, "USD"), money(25, "USD"));
  expect(r.minorUnits).toBe(125);
  expect(r.currency).toBe("USD");
});

it("addMoney rejects mixed currencies at compile time and at runtime", () => {
  const usd = money(100, "USD");
  const eur = money(100, "EUR");
  // @ts-expect-error different currencies must not type-check
  expect(() => addMoney(usd, eur)).toThrow(Error);
  expect(() => addMoney(usd as never, eur as never)).toThrow(Error);
});

it("money rejects non-integer minor units with RangeError", () => {
  expect(() => money(1.5, "USD")).toThrow(RangeError);
  expect(() => money(NaN, "USD")).toThrow(RangeError);
});

it("allocateMoney splits with zero loss, extra units to earliest shares", () => {
  const ten = (r: number[]) => allocateMoney(money(10, "USD"), r).map((m: { minorUnits: number }) => m.minorUnits);
  expect(ten([1, 1, 1])).toEqual([4, 3, 3]);
  expect(allocateMoney(money(100, "USD"), [1, 1, 1]).map((m: { minorUnits: number }) => m.minorUnits)).toEqual([34, 33, 33]);
  expect(ten([3, 1])).toEqual([8, 2]);
  expect(ten([0, 1])).toEqual([0, 10]);
  expect(ten([1, 0, 1])).toEqual([5, 0, 5]);
  expect(allocateMoney(money(1, "EUR"), [1, 1, 1]).map((m: { minorUnits: number }) => m.minorUnits)).toEqual([1, 0, 0]);
});

it("allocateMoney keeps the currency and always sums to the total", () => {
  const out = allocateMoney(money(1001, "GBP"), [7, 3, 11, 5]);
  expect(out).toHaveLength(4);
  for (const m of out) expect(m.currency).toBe("GBP");
  expect(out.reduce((s: number, m: { minorUnits: number }) => s + m.minorUnits, 0)).toBe(1001);
});

it("allocateMoney throws RangeError on negative or all-zero ratios", () => {
  const t = money(100, "USD");
  expect(() => allocateMoney(t, [3, -1])).toThrow(RangeError);
  expect(() => allocateMoney(t, [0, 0])).toThrow(RangeError);
  expect(() => allocateMoney(t, [-1, -2])).toThrow(RangeError);
});

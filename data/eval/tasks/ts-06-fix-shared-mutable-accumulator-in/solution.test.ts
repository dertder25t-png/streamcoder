import { describe, expect, it } from "vitest";
import { groupTransactionsByCurrency } from "./solution";

describe("groupTransactionsByCurrency", () => {
  it("gives each currency its own bucket", () => {
    const r = groupTransactionsByCurrency([
      { id: "a", currency: "USD", amountMinor: 100 },
      { id: "b", currency: "EUR", amountMinor: 250 },
      { id: "c", currency: "USD", amountMinor: 5 },
    ]);
    expect(r).toEqual({
      USD: { count: 2, totalMinor: 105, ids: ["a", "c"] },
      EUR: { count: 1, totalMinor: 250, ids: ["b"] },
    });
    expect(r.USD).not.toBe(r.EUR);
  });

  it("keeps separate calls isolated", () => {
    groupTransactionsByCurrency([{ id: "x", currency: "JPY", amountMinor: 999 }]);
    const r = groupTransactionsByCurrency([{ id: "y", currency: "JPY", amountMinor: 1 }]);
    expect(r).toEqual({ JPY: { count: 1, totalMinor: 1, ids: ["y"] } });
  });

  it("sums integer minor units exactly, including refunds", () => {
    const items = Array.from({ length: 1000 }, (_, i) => ({ id: `t${i}`, currency: "USD", amountMinor: 1 }));
    items.push({ id: "refund", currency: "USD", amountMinor: -333 });
    const r = groupTransactionsByCurrency(items);
    expect(r.USD.totalMinor).toBe(667);
    expect(Number.isInteger(r.USD.totalMinor)).toBe(true);
    expect(r.USD.count).toBe(1001);
  });

  it("returns an empty object for no items", () => {
    expect(groupTransactionsByCurrency([])).toEqual({});
  });
});

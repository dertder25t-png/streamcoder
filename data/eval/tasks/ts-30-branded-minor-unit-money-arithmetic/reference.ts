declare const brand: unique symbol;
export type Money<C extends string> = {
  readonly minorUnits: number;
  readonly currency: C;
  readonly [brand]?: true;
};

export function money<C extends string>(minorUnits: number, currency: C): Money<C> {
  if (!Number.isInteger(minorUnits)) throw new RangeError("minorUnits must be an integer");
  return { minorUnits, currency };
}

export function addMoney<C extends string>(a: Money<C>, b: Money<NoInfer<C>>): Money<C> {
  if (a.currency !== b.currency) throw new Error("currency mismatch");
  return money(a.minorUnits + b.minorUnits, a.currency);
}

export function allocateMoney<C extends string>(total: Money<C>, ratios: readonly number[]): Money<C>[] {
  if (!Number.isInteger(total.minorUnits)) throw new RangeError("minorUnits must be an integer");
  if (ratios.some((r) => !Number.isFinite(r) || r < 0)) throw new RangeError("bad ratio");
  const sum = ratios.reduce((s, r) => s + r, 0);
  if (!(sum > 0)) throw new RangeError("ratios must sum to > 0");
  const shares = ratios.map((r) => Math.floor((total.minorUnits * r) / sum));
  let left = total.minorUnits - shares.reduce((s, x) => s + x, 0);
  for (let i = 0; left > 0; i = (i + 1) % shares.length) {
    if (ratios[i] > 0) { shares[i]++; left--; }
  }
  return shares.map((s) => money(s, total.currency));
}

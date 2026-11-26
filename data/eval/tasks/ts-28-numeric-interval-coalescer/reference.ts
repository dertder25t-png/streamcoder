export function subtractIntervals(
  base: readonly [number, number][],
  cutouts: readonly [number, number][],
): [number, number][] {
  for (const [s, e] of [...base, ...cutouts]) {
    if (s > e) throw new RangeError(`inverted interval [${s}, ${e})`);
  }
  const norm = (list: readonly [number, number][]): [number, number][] => {
    const sorted = list.filter(([s, e]) => s < e).map(([s, e]): [number, number] => [s, e]).sort((a, b) => a[0] - b[0]);
    const out: [number, number][] = [];
    for (const [s, e] of sorted) {
      const last = out[out.length - 1];
      if (last && s <= last[1]) last[1] = Math.max(last[1], e);
      else out.push([s, e]);
    }
    return out;
  };
  const cuts = norm(cutouts);
  const result: [number, number][] = [];
  for (const [bs, be] of norm(base)) {
    let cur = bs;
    for (const [cs, ce] of cuts) {
      if (ce <= cur) continue;
      if (cs >= be) break;
      if (cs > cur) result.push([cur, cs]);
      cur = Math.max(cur, ce);
      if (cur >= be) break;
    }
    if (cur < be) result.push([cur, be]);
  }
  return result;
}

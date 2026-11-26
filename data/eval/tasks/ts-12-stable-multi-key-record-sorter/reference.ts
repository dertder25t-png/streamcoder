export function sortRecordsByKeys<T>(
  items: readonly T[],
  specs: readonly { key: keyof T; direction?: "asc" | "desc" }[],
): T[] {
  const cmp = (a: unknown, b: unknown): number => {
    if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
    return (a as string | number) < (b as string | number) ? -1 : (a as string | number) > (b as string | number) ? 1 : 0;
  };
  return items
    .map((item, index) => ({ item, index }))
    .sort((x, y) => {
      for (const { key, direction = "asc" } of specs) {
        const c = cmp(x.item[key], y.item[key]);
        if (c !== 0) return direction === "desc" ? -c : c;
      }
      return x.index - y.index;
    })
    .map((w) => w.item);
}

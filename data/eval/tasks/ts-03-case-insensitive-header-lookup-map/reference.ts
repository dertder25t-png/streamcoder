export function createHeaderMap(entries?: Iterable<[string, string]>) {
  const store = new Map<string, { name: string; value: string }>();
  const api = {
    get(name: string): string | undefined {
      return store.get(name.toLowerCase())?.value;
    },
    set(name: string, value: string) {
      store.set(name.toLowerCase(), { name, value });
      return api;
    },
    has(name: string): boolean {
      return store.has(name.toLowerCase());
    },
    delete(name: string): boolean {
      return store.delete(name.toLowerCase());
    },
    toRecord(): Record<string, string> {
      const out: Record<string, string> = {};
      for (const { name, value } of store.values()) out[name] = value;
      return out;
    },
  };
  if (entries) for (const [k, v] of entries) api.set(k, v);
  return api;
}

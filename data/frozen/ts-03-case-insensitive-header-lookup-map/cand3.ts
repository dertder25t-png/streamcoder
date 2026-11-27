type HeaderMap = {
  get(name: string): string | undefined;
  set(name: string, value: string): void;
  has(name: string): boolean;
  delete(name: string): boolean;
  toRecord(): { [key: string]: string };
};

export function createHeaderMap(entries?: Iterable<[string, string]>): HeaderMap {
  const map = new Map<string, string>();
  const casingMap = new Map<string, string>();

  if (entries) {
    for (const [name, value] of entries) {
      map.set(name.toLowerCase(), value);
      casingMap.set(name.toLowerCase(), name);
    }
  }

  return {
    get(name: string): string | undefined {
      return map.get(name.toLowerCase());
    },
    set(name: string, value: string): void {
      const lowerName = name.toLowerCase();
      map.set(lowerName, value);
      casingMap.set(lowerName, name);
    },
    has(name: string): boolean {
      return map.has(name.toLowerCase());
    },
    delete(name: string): boolean {
      const lowerName = name.toLowerCase();
      if (map.has(lowerName)) {
        map.delete(lowerName);
        casingMap.delete(lowerName);
        return true;
      }
      return false;
    },
    toRecord(): { [key: string]: string } {
      const record: { [key: string]: string } = {};
      for (const [lowerName, name] of casingMap) {
        record[name] = map.get(lowerName)!;
      }
      return record;
    },
  };
}

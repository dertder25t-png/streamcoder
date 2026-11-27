/**
 * Creates a header map that allows case-insensitive access to headers while
 * preserving the original casing of the most recent set.
 */
export function createHeaderMap(entries?: Iterable<[string, string]>): HeaderMap {
  const headers: Map<string, string> = new Map();
  const caseInsensitiveMap: Map<string, string> = new Map();

  if (entries) {
    for (const [name, value] of entries) {
      set(name, value);
    }
  }

  function set(name: string, value: string): void {
    const lowerCaseName = name.toLowerCase();
    headers.set(lowerCaseName, value);
    caseInsensitiveMap.set(lowerCaseName, name);
  }

  function get(name: string): string | undefined {
    return headers.get(name.toLowerCase());
  }

  function has(name: string): boolean {
    return headers.has(name.toLowerCase());
  }

  function delete(name: string): boolean {
    const lowerCaseName = name.toLowerCase();
    if (headers.has(lowerCaseName)) {
      headers.delete(lowerCaseName);
      caseInsensitiveMap.delete(lowerCaseName);
      return true;
    }
    return false;
  }

  function toRecord(): Record<string, string> {
    const record: Record<string, string> = {};
    for (const [lowerCaseName, originalName] of caseInsensitiveMap) {
      record[originalName] = headers.get(lowerCaseName)!;
    }
    return record;
  }

  return {
    get,
    set,
    has,
    delete,
    toRecord,
  };
}

// Type definitions
interface HeaderMap {
  get(name: string): string | undefined;
  set(name: string, value: string): void;
  has(name: string): boolean;
  delete(name: string): boolean;
  toRecord(): Record<string, string>;
}

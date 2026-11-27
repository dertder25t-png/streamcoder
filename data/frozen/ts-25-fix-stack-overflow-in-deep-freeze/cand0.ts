export function deepFreezeSafe<T>(value: T): Readonly<T> {
  const seen = new WeakSet();

  function freeze(value: any) {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) return;
      seen.add(value);
      Object.freeze(value);
      for (const key of Reflect.ownKeys(value)) {
        freeze((value as Record<string | symbol, unknown>)[key]);
      }
    }
  }

  freeze(value);
  return value;
}

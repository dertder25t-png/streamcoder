export function deepFreezeSafe<T>(value: T): Readonly<T> {
  const seen = new WeakSet();

  function freeze(value: any): void {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
      if (Array.isArray(value)) {
        value.forEach(freeze);
      } else {
        for (const key of Reflect.ownKeys(value)) {
          freeze((value as Record<string | symbol, unknown>)[key]);
        }
      }
      Object.freeze(value);
    }
  }

  freeze(value);
  return value;
}

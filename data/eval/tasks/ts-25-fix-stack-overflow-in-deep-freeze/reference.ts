export function deepFreezeSafe<T>(value: T): Readonly<T> {
  const seen = new WeakSet<object>();
  const walk = (v: unknown): void => {
    if ((typeof v !== "object" && typeof v !== "function") || v === null) return;
    if (seen.has(v)) return;
    seen.add(v);
    Object.freeze(v);
    for (const key of Reflect.ownKeys(v)) {
      const desc = Object.getOwnPropertyDescriptor(v, key);
      if (desc && "value" in desc) walk(desc.value);
    }
  };
  walk(value);
  return value;
}

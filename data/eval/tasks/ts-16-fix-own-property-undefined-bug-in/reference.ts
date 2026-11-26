export function pickDefinedKeys<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
    const value = source[key];
    if (value === undefined) continue;
    result[key] = value;
  }
  return result;
}

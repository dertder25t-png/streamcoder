export function pickDefinedKeys<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (source.hasOwnProperty(key) && source[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
}

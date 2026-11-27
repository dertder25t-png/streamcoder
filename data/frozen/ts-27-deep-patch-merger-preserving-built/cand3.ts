type DeepPatch<T> = {
  [K in keyof T]?: T[K] extends object
    ? T[K] extends Date | RegExp | Function | Array<any> | Map<any, any> | Set<any>
      ? T[K]
      : DeepPatch<T[K]>
    : T[K];
};

export function applyDeepPatch<T extends object>(base: T, patch: DeepPatch<T>): T {
  const result: T = { ...base };

  for (const key in patch) {
    if (patch.hasOwnProperty(key)) {
      const value = patch[key];
      if (typeof value === 'object' && value !== null) {
        if (value instanceof Date || value instanceof RegExp || value instanceof Function || value instanceof Array || value instanceof Map || value instanceof Set) {
          result[key] = value;
        } else {
          result[key] = applyDeepPatch(result[key] as object, value as DeepPatch<T[key]>);
        }
      } else {
        result[key] = value;
      }
    }
  }

  return result;
}

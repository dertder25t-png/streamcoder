export type DeepPatch<T> = {
  [K in keyof T]?: T[K] extends object ? (T[K] extends Date | RegExp | Function | Array<any> | Map<any, any> | Set<any> ? T[K] : DeepPatch<T[K]>) : T[K];
};

export function applyDeepPatch<T extends object>(base: T, patch: DeepPatch<T>): T {
  const result = { ...base };

  for (const key in patch) {
    if (patch.hasOwnProperty(key)) {
      const baseValue = base[key];
      const patchValue = patch[key];

      if (baseValue instanceof Date || baseValue instanceof RegExp || typeof baseValue === 'function' || Array.isArray(baseValue) || baseValue instanceof Map || baseValue instanceof Set) {
        result[key] = patchValue;
      } else if (typeof baseValue === 'object' && baseValue !== null) {
        result[key] = applyDeepPatch(baseValue, patchValue as DeepPatch<typeof baseValue>);
      }
    }
  }

  return result;
}

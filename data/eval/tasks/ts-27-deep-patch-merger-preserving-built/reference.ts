type Atomic = Date | RegExp | Map<any, any> | Set<any> | ((...args: any[]) => any) | readonly unknown[];

export type DeepPatch<T> = {
  [K in keyof T]?: T[K] extends Atomic ? T[K] : T[K] extends object ? DeepPatch<T[K]> : T[K];
};

function isPlain(v: unknown): v is Record<string, unknown> {
  if (typeof v !== "object" || v === null) return false;
  const p = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
}

export function applyDeepPatch<T extends object>(base: T, patch: DeepPatch<T>): T {
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, pv] of Object.entries(patch as Record<string, unknown>)) {
    if (pv === undefined) continue;
    const bv = out[k];
    out[k] = isPlain(pv) && isPlain(bv) ? applyDeepPatch(bv, pv as never) : pv;
  }
  return out as T;
}

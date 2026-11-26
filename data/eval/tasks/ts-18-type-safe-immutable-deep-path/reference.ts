export type DotPath<T> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object ? K | `${K}.${DotPath<T[K]>}` : K;
    }[keyof T & string]
  : never;

export type PathValue<T, P extends string> = P extends `${infer H}.${infer R}`
  ? H extends keyof T
    ? PathValue<T[H], R>
    : never
  : P extends keyof T
    ? T[P]
    : never;

const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);

export function setByPath<T extends object, P extends DotPath<T>>(
  obj: T,
  path: P,
  value: PathValue<T, P>,
): T {
  const segments = (path as string).split(".");
  if (segments.some((s) => FORBIDDEN.has(s))) throw new Error("Forbidden path segment");
  const update = (node: unknown, i: number): unknown => {
    const copy: Record<string, unknown> = { ...(node as Record<string, unknown>) };
    const key = segments[i];
    copy[key] = i === segments.length - 1 ? value : update(copy[key], i + 1);
    return copy;
  };
  return update(obj, 0) as T;
}

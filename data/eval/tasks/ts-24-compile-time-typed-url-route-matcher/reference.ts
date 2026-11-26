type ParamNames<P extends string> = P extends `${string}:${infer Name}/${infer Rest}`
  ? Name | ParamNames<`/${Rest}`>
  : P extends `${string}:${infer Name}`
    ? Name
    : never;

export type RouteParams<P extends string> = { [K in ParamNames<P>]: string };

export function createRouteMatcher<P extends string>(
  pattern: P,
): (path: string) => RouteParams<P> | null {
  const patternSegs = pattern.split("/");
  return (path: string): RouteParams<P> | null => {
    const segs = path.split("/");
    if (segs.length !== patternSegs.length) return null;
    const params: Record<string, string> = {};
    for (let i = 0; i < patternSegs.length; i++) {
      const p = patternSegs[i];
      const s = segs[i];
      if (p.startsWith(":")) {
        if (s === "") return null;
        try {
          params[p.slice(1)] = decodeURIComponent(s);
        } catch {
          return null;
        }
      } else if (p !== s) {
        return null;
      }
    }
    return params as RouteParams<P>;
  };
}

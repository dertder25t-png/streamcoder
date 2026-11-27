import { decodeURIComponent } from 'node:util';

type StaticParams<P extends string> = P extends `${infer L}/${infer R}`
  ? { [K in keyof StaticParams<L>]: StaticParams<L>[K] } & StaticParams<R>
  : P extends `${infer L}:${infer R}`
  ? { [K in R]: string } & StaticParams<L>
  : P extends `:${infer R}`
  ? { [K in R]: string }
  : Record<never, never>;

type RouteMatcher<P extends string> = (path: string) => StaticParams<P> | null;

function createRouteMatcher<P extends string>(pattern: P): RouteMatcher<P> {
  const regex = new RegExp(`^${pattern.replace(/:[^/]+/g, '([^/]+)')}$`);
  return (path) => {
    const match = path.match(regex);
    if (!match) return null;
    const params: Partial<StaticParams<P>> = {};
    match.slice(1).forEach((value, index) => {
      const key = Object.keys(params)[index];
      if (key) params[key] = decodeURIComponent(value);
    });
    return params as StaticParams<P>;
  };
}

export { createRouteMatcher };

# Narrow a union with a discriminant
```ts
type Result<T> = { ok: true; value: T } | { ok: false; error: string };
function show(r: Result<number>) {
  if (r.ok) return r.value.toFixed(2); // r is { ok: true; value: number } here
  return `error: ${r.error}`;
}
```
Use a literal field (`ok`, `type`, `kind`) shared by every member. Add `default: const _x: never = r;` in a switch to make the compiler flag unhandled cases.

# Write a type guard for unknown data
```ts
function isUser(v: unknown): v is { id: string; age: number } {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    && typeof (v as Record<string, unknown>).id === "string"
    && Number.isInteger((v as Record<string, unknown>).age);
}
```
Check `null` and arrays explicitly: `typeof null === "object"` and arrays are objects too.

# Keep literal types in generics
```ts
function pick<const T extends readonly string[]>(xs: T): T[number] { return xs[0]; }
const k = pick(["a", "b"]); // "a" | "b", not string
```
`const` type parameters (TS 5.0+) or `as const` at the call site stop widening to `string`.

# Validate config shape without losing inferred types
```ts
const routes = { home: "/", user: "/u/:id" } satisfies Record<string, `/${string}`>;
routes.user; // still the literal "/u/:id"
```
`satisfies` checks against a type but keeps the narrower inferred type; `: Type` would widen it.

# Common utility types
`Partial<T>`, `Required<T>`, `Readonly<T>`, `Pick<T, K>`, `Omit<T, K>`, `Record<K, V>`, `ReturnType<F>`, `Parameters<F>`, `Awaited<P>`, `NonNullable<T>`, `Extract<U, X>`, `Exclude<U, X>`.
Mapped type with key remapping: `{ [K in keyof T as K extends `on${string}` ? K : never]: T[K] }`.

# Recursive types without "excessively deep" errors (TS2589)
Stop recursion at leaves: check `T extends Date | ((...a: any[]) => any) | readonly unknown[] ? Leaf : ...` before recursing into objects, and add a depth counter tuple (`D extends unknown[]`, recurse with `[...D, 1]`, stop at `D["length"] extends 6`) for very deep data.

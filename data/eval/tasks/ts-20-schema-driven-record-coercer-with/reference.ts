export type ParseError = { path: string; message: string };
export type ParseResult<T> = { ok: true; data: T } | { ok: false; errors: ParseError[] };

export interface Schema<T> {
  readonly optional?: boolean;
  parse(input: unknown): ParseResult<T>;
  _check(input: unknown, path: string, errors: ParseError[]): { value: T } | undefined;
}

function make<T>(check: (input: unknown, path: string, errors: ParseError[]) => { value: T } | undefined, optional = false): Schema<T> {
  return {
    optional,
    _check: check,
    parse(input) {
      const errors: ParseError[] = [];
      const r = check(input, "", errors);
      if (errors.length || !r) return { ok: false, errors };
      return { ok: true, data: r.value };
    },
  };
}

function prim<T>(name: string, test: (v: unknown) => boolean): Schema<T> {
  return make<T>((v, path, errors) => {
    if (test(v)) return { value: v as T };
    errors.push({ path, message: `Expected ${name}` });
    return undefined;
  });
}

type AnySchema = Schema<any>;
export type Infer<S> = S extends Schema<infer T> ? T : never;
type OptKeys<Sh extends Record<string, AnySchema>> = { [K in keyof Sh]: Sh[K] extends Schema<infer T> & { readonly optional: true } ? K : never }[keyof Sh];
type Flat<T> = { [K in keyof T]: T[K] };
type ObjOut<Sh extends Record<string, AnySchema>> = Flat<
  { [K in Exclude<keyof Sh, OptKeys<Sh>>]: Infer<Sh[K]> } & { [K in OptKeys<Sh>]?: Infer<Sh[K]> }
>;

export const s = {
  string: () => prim<string>("string", (v) => typeof v === "string"),
  number: () => prim<number>("number", (v) => typeof v === "number" && Number.isFinite(v)),
  boolean: () => prim<boolean>("boolean", (v) => typeof v === "boolean"),
  optional<T>(inner: Schema<T>): Schema<T | undefined> & { readonly optional: true } {
    return make<T | undefined>((v, path, errors) => {
      if (v === undefined) return { value: undefined };
      return inner._check(v, path, errors);
    }, true) as Schema<T | undefined> & { readonly optional: true };
  },
  object<Sh extends Record<string, AnySchema>>(shape: Sh): Schema<ObjOut<Sh>> {
    return make<ObjOut<Sh>>((v, path, errors) => {
      if (typeof v !== "object" || v === null || Array.isArray(v)) {
        errors.push({ path, message: "Expected object" });
        return undefined;
      }
      const out: Record<string, unknown> = {};
      let failed = false;
      for (const key of Object.keys(shape)) {
        const sub = path ? `${path}.${key}` : key;
        const n = errors.length;
        const r = shape[key]._check((v as Record<string, unknown>)[key], sub, errors);
        if (errors.length > n || !r) failed = true;
        else if (r.value !== undefined) out[key] = r.value;
      }
      return failed ? undefined : { value: out as ObjOut<Sh> };
    });
  },
};

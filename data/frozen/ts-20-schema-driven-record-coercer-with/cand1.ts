import { isPlainObject, isFinite } from 'lodash-es';

type FieldError = {
  path: string;
  message: string;
};

type ParseResult<T> = { ok: true; data: T } | { ok: false; errors: FieldError[] };

type Schema<T> = {
  parse: (input: unknown) => ParseResult<T>;
};

type Infer<S> = S extends Schema<infer T> ? T : never;

const s = {
  string: (): Schema<string> => ({
    parse: (input) => {
      if (typeof input === 'string') {
        return { ok: true, data: input };
      }
      return {
        ok: false,
        errors: [{ path: '', message: 'Expected a string' }],
      };
    },
  }),

  number: (): Schema<number> => ({
    parse: (input) => {
      if (typeof input === 'number' && isFinite(input)) {
        return { ok: true, data: input };
      }
      return {
        ok: false,
        errors: [{ path: '', message: 'Expected a finite number' }],
      };
    },
  }),

  boolean: (): Schema<boolean> => ({
    parse: (input) => {
      if (typeof input === 'boolean') {
        return { ok: true, data: input };
      }
      return {
        ok: false,
        errors: [{ path: '', message: 'Expected a boolean' }],
      };
    },
  }),

  optional: <T>(inner: Schema<T>): Schema<T | undefined> => ({
    parse: (input) => {
      if (input === undefined) {
        return { ok: true, data: undefined };
      }
      return inner.parse(input);
    },
  }),

  object: <T extends Record<string, Schema<any>>>(shape: T): Schema<Infer<T>> => ({
    parse: (input) => {
      if (input === null || !isPlainObject(input)) {
        return {
          ok: false,
          errors: [{ path: '', message: 'Expected an object' }],
        };
      }

      const errors: FieldError[] = [];
      const data: Partial<Infer<T>> = {};

      for (const [key, schema] of Object.entries(shape)) {
        const result = schema.parse(input[key]);
        if (!result.ok) {
          errors.push(...result.errors.map(e => ({ ...e, path: `${key}${e.path ? `.${e.path}` : ''}` })));
        } else {
          data[key] = result.data;
        }
      }

      if (errors.length > 0) {
        return { ok: false, errors };
      }
      return { ok: true, data: data as Infer<T> };
    },
  }),
};

export { s, Infer };

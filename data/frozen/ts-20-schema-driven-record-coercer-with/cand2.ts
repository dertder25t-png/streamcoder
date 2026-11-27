type Schema<T> = {
  type: 'string' | 'number' | 'boolean' | 'object' | 'optional';
  inner?: Schema<any>;
  shape?: { [K in keyof any]: Schema<any> };
  validate: (input: unknown, path: string) => { ok: boolean; data: any; errors: { path: string; message: string }[] };
};

type Infer<S> = S extends Schema<infer T> ? T : never;

const s = {
  string: (): Schema<string> => ({
    type: 'string',
    validate: (input, path) => {
      if (typeof input === 'string') {
        return { ok: true, data: input, errors: [] };
      } else {
        return {
          ok: false,
          errors: [{ path, message: `Expected a string, but got ${typeof input}` }]
        };
      }
    }
  }),
  number: (): Schema<number> => ({
    type: 'number',
    validate: (input, path) => {
      if (typeof input === 'number' && Number.isFinite(input)) {
        return { ok: true, data: input, errors: [] };
      } else {
        return {
          ok: false,
          errors: [{ path, message: `Expected a finite number, but got ${typeof input}` }]
        };
      }
    }
  }),
  boolean: (): Schema<boolean> => ({
    type: 'boolean',
    validate: (input, path) => {
      if (typeof input === 'boolean') {
        return { ok: true, data: input, errors: [] };
      } else {
        return {
          ok: false,
          errors: [{ path, message: `Expected a boolean, but got ${typeof input}` }]
        };
      }
    }
  }),
  optional: <T>(inner: Schema<T>): Schema<T | undefined> => ({
    type: 'optional',
    inner,
    validate: (input, path) => {
      if (input === undefined) {
        return { ok: true, data: undefined, errors: [] };
      }
      return inner.validate(input, path);
    }
  }),
  object: <T>(shape: { [K in keyof T]: Schema<T[K]> }): Schema<T> => ({
    type: 'object',
    shape,
    validate: (input, path) => {
      if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        return {
          ok: false,
          errors: [{ path, message: `Expected an object, but got ${typeof input}` }]
        };
      }
      const result: { [K in keyof T]?: T[K] } = {};
      const errors: { path: string; message: string }[] = [];
      for (const key in shape) {
        if (shape.hasOwnProperty(key)) {
          const { ok, data, errors: keyErrors } = shape[key].validate(input[key], `${path ? `${path}.` : ''}${key}`);
          if (!ok) {
            errors.push(...keyErrors);
          } else {
            result[key] = data;
          }
        }
      }
      return { ok: errors.length === 0, data: result, errors };
    }
  })
};

export { s, Infer };

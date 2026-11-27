type Schema<T> = {
  parse(input: unknown): { ok: true; data: T } | { ok: false; errors: { path: string; message: string }[] };
};

type Infer<T extends Schema<any>> = T extends Schema<infer U> ? U : never;

const s = {
  string(): Schema<string> {
    return {
      parse(input: unknown) {
        if (typeof input === 'string') {
          return { ok: true, data: input };
        } else {
          return { ok: false, errors: [{ path: '', message: 'Expected a string' }] };
        }
      }
    };
  },
  number(): Schema<number> {
    return {
      parse(input: unknown) {
        if (typeof input === 'number' && isFinite(input)) {
          return { ok: true, data: input };
        } else {
          return { ok: false, errors: [{ path: '', message: 'Expected a finite number' }] };
        }
      }
    };
  },
  boolean(): Schema<boolean> {
    return {
      parse(input: unknown) {
        if (typeof input === 'boolean') {
          return { ok: true, data: input };
        } else {
          return { ok: false, errors: [{ path: '', message: 'Expected a boolean' }] };
        }
      }
    };
  },
  optional(inner: Schema<any>): Schema<any> {
    return {
      parse(input: unknown) {
        if (input === undefined) {
          return { ok: true, data: undefined };
        }
        const result = inner.parse(input);
        if (result.ok) {
          return result;
        } else {
          result.errors.forEach((error) => {
            error.path = `.${error.path}`.replace(/^\./, '');
          });
          return result;
        }
      }
    };
  },
  object(shape: { [key: string]: Schema<any> }): Schema<{ [key in keyof typeof shape]?: Infer<typeof shape[key]> }> {
    return {
      parse(input: unknown) {
        if (typeof input !== 'object' || input === null || Array.isArray(input)) {
          return { ok: false, errors: [{ path: '', message: 'Expected a non-null, non-array object' }] };
        }
        const result: { [key: string]: Infer<typeof shape[key]> } = {};
        const errors: { path: string; message: string }[] = [];
        for (const key in shape) {
          if (shape.hasOwnProperty(key)) {
            const innerSchema = shape[key];
            const value = (input as any)[key];
            const innerResult = innerSchema.parse(value);
            if (innerResult.ok) {
              result[key] = innerResult.data;
            } else {
              innerResult.errors.forEach((error) => {
                errors.push({ path: `${key}${error.path}`, message: error.message });
              });
            }
          }
        }
        return errors.length > 0 ? { ok: false, errors } : { ok: true, data: result };
      }
    };
  }
};

export { s };

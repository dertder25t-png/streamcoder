import { parseInt } from 'node:util';

interface ConfigSpec {
  type: 'string' | 'int' | 'boolean';
  required?: boolean;
  default?: string | number | boolean;
}

export function readEnvConfig(env: Record<string, string | undefined>, spec: Record<string, ConfigSpec>): Record<string, string | number | boolean> {
  const errors: string[] = [];
  const result: Record<string, string | number | boolean> = {};

  for (const key in spec) {
    const { type, required = false, default: defaultValue } = spec[key];
    const value = env[key] === '' ? undefined : env[key];

    if (value === undefined) {
      if (required) {
        errors.push(key);
      } else {
        result[key] = defaultValue !== undefined ? defaultValue : undefined;
      }
    } else {
      try {
        switch (type) {
          case 'string':
            result[key] = value;
            break;
          case 'int':
            result[key] = parseInt(value, 10);
            if (isNaN(result[key])) {
              errors.push(key);
            }
            break;
          case 'boolean':
            if (value === 'true') {
              result[key] = true;
            } else if (value === 'false') {
              result[key] = false;
            } else {
              errors.push(key);
            }
            break;
        }
      } catch {
        errors.push(key);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Missing or invalid keys: ${errors.join(', ')}`);
  }

  return result;
}

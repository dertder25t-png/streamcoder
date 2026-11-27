import { parseInt } from 'node:util';

interface ConfigSpec {
  type: 'string' | 'int' | 'boolean';
  required?: boolean;
  default?: string | number | boolean;
}

interface Config {
  [key: string]: string | number | boolean;
}

export function readEnvConfig(env: Record<string, string | undefined>, spec: Record<string, ConfigSpec>): Config {
  const errors: string[] = [];
  const result: Config = {};

  for (const key in spec) {
    const { type, required = false, default: defaultValue } = spec[key];
    const value = env[key];

    if (value === undefined || value === '') {
      if (required) {
        errors.push(key);
      } else {
        result[key] = defaultValue;
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
            if (value.toLowerCase() !== 'true' && value.toLowerCase() !== 'false') {
              errors.push(key);
            } else {
              result[key] = value.toLowerCase() === 'true';
            }
            break;
        }
      } catch (e) {
        errors.push(key);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Missing or invalid keys: ${errors.join(', ')}`);
  }

  return result;
}

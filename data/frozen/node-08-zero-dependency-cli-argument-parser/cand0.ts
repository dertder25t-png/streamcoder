import { parse } from 'node:querystring';

interface ParsedOptions {
  options: Record<string, boolean | string | number>;
  positionals: string[];
}

export function parseCliArgs(argv: readonly string[], schema: Record<string, { type: "boolean" | "string" | "number"; alias?: string; default?: boolean | string | number }>): ParsedOptions {
  const options: Record<string, boolean | string | number> = {};
  const positionals: string[] = [];
  let isTerminated = false;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (isTerminated) {
      positionals.push(arg);
    } else if (arg === '--') {
      isTerminated = true;
    } else if (arg.startsWith('--')) {
      const [key, value] = arg.split('=');
      const optionKey = key.replace(/^--/, '');
      const optionSchema = schema[optionKey];
      if (!optionSchema) {
        throw new Error(`Unknown flag: ${arg}`);
      }
      if (optionSchema.type === 'boolean') {
        options[optionKey] = value === undefined ? true : value === 'false' ? false : true;
      } else {
        if (value === undefined) {
          if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
            options[optionKey] = parse(argv[++i]);
          } else {
            throw new Error(`No value provided for option: ${arg}`);
          }
        } else {
          options[optionKey] = parse(value);
        }
      }
    } else if (arg.startsWith('-')) {
      const optionKey = arg.replace(/^-/, '');
      const optionSchema = schema[optionKey];
      if (!optionSchema) {
        throw new Error(`Unknown flag: ${arg}`);
      }
      if (optionSchema.type === 'boolean') {
        options[optionKey] = false;
      } else {
        if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
          options[optionKey] = parse(argv[++i]);
        } else {
          throw new Error(`No value provided for option: ${arg}`);
        }
      }
    } else {
      positionals.push(arg);
    }
  }

  for (const key in schema) {
    if (schema[key].default !== undefined && options[key] === undefined) {
      options[key] = schema[key].default;
    }
  }

  return { options, positionals };
}

import { parse } from 'node:querystring';

interface ParsedOptions {
  options: Record<string, boolean | string | number>;
  positionals: string[];
}

export function parseCliArgs(argv: readonly string[], schema: Record<string, { type: "boolean" | "string" | "number"; alias?: string; default?: boolean | string | number }>): ParsedOptions {
  const options: Record<string, boolean | string | number> = {};
  const positionals: string[] = [];
  let inPositionals = false;

  const args = [...argv]; // Copy to avoid mutating the input
  args.shift(); // Remove the first element, which is the command name

  while (args.length > 0) {
    const arg = args.shift() as string;

    if (inPositionals || arg.startsWith('--')) {
      if (arg === '--') {
        inPositionals = true;
      } else if (arg.startsWith('--no-')) {
        const key = arg.slice(5);
        if (schema[key]) {
          options[key] = false;
        } else {
          throw new Error(`Unknown flag: ${arg}`);
        }
      } else if (arg.startsWith('--')) {
        const [key, value] = arg.slice(2).split('=');
        if (schema[key]) {
          if (value === undefined) {
            if (args.length > 0) {
              options[key] = parseValue(args.shift() as string, schema[key].type);
            } else {
              throw new Error(`Value missing for option: ${arg}`);
            }
          } else {
            options[key] = parseValue(value, schema[key].type);
          }
        } else {
          throw new Error(`Unknown flag: ${arg}`);
        }
      } else {
        throw new Error(`Invalid argument: ${arg}`);
      }
    } else if (arg.startsWith('-')) {
      for (let i = 0; i < arg.length; i++) {
        const char = arg[i];
        const key = schema[char];
        if (key) {
          options[key] = true;
        } else {
          throw new Error(`Unknown flag: -${char}`);
        }
      }
    } else {
      positionals.push(arg);
    }
  }

  for (const key in schema) {
    if (options[key] === undefined && schema[key].default !== undefined) {
      options[key] = schema[key].default;
    }
  }

  return { options, positionals };
}

function parseValue(value: string, type: "boolean" | "string" | "number"): boolean | string | number {
  if (type === "boolean") {
    return value.toLowerCase() !== 'false';
  } else if (type === "number") {
    return Number(value);
  } else {
    return value;
  }
}

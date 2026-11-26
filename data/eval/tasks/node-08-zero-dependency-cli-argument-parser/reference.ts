type Def = { type: "boolean" | "string" | "number"; alias?: string; default?: boolean | string | number };
type Val = boolean | string | number;

export function parseCliArgs(argv: readonly string[], schema: Record<string, Def>): { options: Record<string, Val>; positionals: string[] } {
  const options: Record<string, Val> = {};
  const positionals: string[] = [];
  const byAlias: Record<string, string> = {};
  for (const [name, d] of Object.entries(schema)) if (d.alias) byAlias[d.alias] = name;
  const conv = (name: string, raw: string): Val => {
    if (schema[name].type === "number") {
      const n = Number(raw);
      if (Number.isNaN(n)) throw new Error(`Invalid number for --${name}: ${raw}`);
      return n;
    }
    return raw;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith("--")) {
      let name = a.slice(2);
      let inline: string | undefined;
      const eq = name.indexOf("=");
      if (eq >= 0) {
        inline = name.slice(eq + 1);
        name = name.slice(0, eq);
      }
      if (!schema[name] && name.startsWith("no-") && schema[name.slice(3)]?.type === "boolean" && inline === undefined) {
        options[name.slice(3)] = false;
        continue;
      }
      if (!schema[name]) throw new Error(`Unknown option: --${name}`);
      if (schema[name].type === "boolean") {
        options[name] = inline === undefined ? true : inline !== "false";
        continue;
      }
      if (inline === undefined) {
        if (i + 1 >= argv.length) throw new Error(`Missing value for --${name}`);
        inline = argv[++i];
      }
      options[name] = conv(name, inline);
    } else if (a.startsWith("-") && a.length > 1) {
      const name = byAlias[a.slice(1)];
      if (!name) throw new Error(`Unknown option: ${a}`);
      if (schema[name].type === "boolean") {
        options[name] = true;
        continue;
      }
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${a}`);
      options[name] = conv(name, argv[++i]);
    } else positionals.push(a);
  }
  for (const [name, d] of Object.entries(schema)) if (!(name in options) && d.default !== undefined) options[name] = d.default;
  return { options, positionals };
}

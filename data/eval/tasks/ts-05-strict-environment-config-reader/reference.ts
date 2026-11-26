type Field = { type: "string" | "int" | "boolean"; required?: boolean; default?: string | number | boolean };
type Spec = Record<string, Field>;

export function readEnvConfig(
  env: Record<string, string | undefined>,
  spec: Spec,
): Record<string, string | number | boolean | undefined> {
  const out: Record<string, string | number | boolean | undefined> = {};
  const bad: string[] = [];
  for (const key of Object.keys(spec)) {
    const f = spec[key];
    const raw = env[key];
    if (raw === undefined || raw === "") {
      if (f.required) bad.push(key);
      else out[key] = f.default;
      continue;
    }
    if (f.type === "string") out[key] = raw;
    else if (f.type === "int") {
      if (/^-?\d+$/.test(raw)) out[key] = parseInt(raw, 10);
      else bad.push(key);
    } else if (raw === "true") out[key] = true;
    else if (raw === "false") out[key] = false;
    else bad.push(key);
  }
  if (bad.length) throw new Error(`Invalid config: ${bad.join(", ")}`);
  return out;
}

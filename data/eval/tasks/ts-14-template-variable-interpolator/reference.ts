export function renderTemplate(
  template: string,
  vars: Record<string, string | number>,
  options?: { strict?: boolean },
): string {
  const strict = options?.strict === true;
  return template.replace(/\{\{\s*([^\s{}]+)\s*\}\}/g, (whole: string, key: string) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) return String(vars[key]);
    if (strict) throw new Error(`Missing template variable: ${key}`);
    return whole;
  });
}

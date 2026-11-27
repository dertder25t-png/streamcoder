export function renderTemplate(template: string, vars: Record<string, string | number>, options?: { strict?: boolean }): string {
    const { strict = false } = options || {};
    const regex = /\{\{(\s*[\w.]+\s*)\}\}/g;
    let match: RegExpExecArray | null;

    return template.replace(regex, (match, key) => {
        key = key.trim();
        if (vars.hasOwnProperty(key)) {
            return String(vars[key]);
        } else if (strict) {
            throw new Error(`Missing variable: ${key}`);
        } else {
            return match;
        }
    });
}

export function renderTemplate(template: string, vars: Record<string, string | number>, options?: { strict?: boolean }): string {
    const { strict = false } = options || {};
    const keys = Object.keys(vars);
    const regex = new RegExp(`{{\\s*(${keys.join('|')})\\s*}}`, 'g');

    return template.replace(regex, (match, key) => {
        const trimmedKey = key.trim();
        if (vars.hasOwnProperty(trimmedKey)) {
            return vars[trimmedKey].toString();
        } else if (strict) {
            throw new Error(`Missing variable: ${trimmedKey}`);
        } else {
            return match;
        }
    });
}

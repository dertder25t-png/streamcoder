function renderTemplate(template: string, vars: Record<string, string | number>, options?: { strict?: boolean }): string {
    const { strict = false } = options || {};
    const keys = Object.keys(vars).filter(key => !key.startsWith('__proto__'));
    const regex = new RegExp(`{{\\s*(${keys.join('|')})\\s*}}`, 'g');

    return template.replace(regex, (match, key) => {
        const value = vars[key];
        if (value === undefined) {
            if (strict) {
                throw new Error(`Missing variable: ${key.trim()}`);
            }
            return match; // leave unknown placeholders untouched
        }
        return value.toString();
    });
}

export { renderTemplate };

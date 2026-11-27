function parseCliArgs(argv: readonly string[], schema: Record<string, { type: "boolean" | "string" | "number"; alias?: string; default?: boolean | string | number }>): { options: Record<string, boolean | string | number>; positionals: string[] } {
    const options: Record<string, boolean | string | number> = {};
    const positionals: string[] = [];
    let parsingPositionals = false;

    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (parsingPositionals || arg === '--') {
            positionals.push(arg);
            parsingPositionals = arg === '--';
        } else if (arg.startsWith('--')) {
            const [key, value] = arg.split('=');
            const optionKey = key.substring(2);
            const option = schema[optionKey];
            if (!option) {
                throw new Error(`Unknown option: ${optionKey}`);
            }
            if (option.type === 'boolean') {
                options[optionKey] = value ? value === 'true' : true;
            } else {
                if (value === undefined) {
                    throw new Error(`Option ${optionKey} requires a value`);
                }
                options[optionKey] = option.type === 'number' ? Number(value) : value;
            }
        } else if (arg.startsWith('-')) {
            const optionKey = arg.substring(1);
            const option = schema[optionKey];
            if (!option) {
                throw new Error(`Unknown option: -${optionKey}`);
            }
            if (option.type === 'boolean') {
                options[optionKey] = true;
            } else {
                const value = argv[i + 1];
                if (!value || value.startsWith('-')) {
                    throw new Error(`Option -${optionKey} requires a value`);
                }
                options[optionKey] = option.type === 'number' ? Number(value) : value;
                i++;
            }
        }
    }

    for (const [key, option] of Object.entries(schema)) {
        if (options[key] === undefined && option.default !== undefined) {
            options[key] = option.type === 'number' ? Number(option.default) : option.default;
        }
    }

    return { options, positionals };
}

export { parseCliArgs };

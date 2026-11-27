function parseBooleanFlags(query: string): Record<string, boolean> {
    const flags: Record<string, boolean> = {};
    const params = (query.startsWith('?') ? query.slice(1) : query).split('&');

    for (const param of params) {
        const [key, value] = param.split('=');
        if (key) {
            const valueStr = value ? decodeURIComponent(value) : '';
            switch (valueStr.toLowerCase()) {
                case 'true':
                case '1':
                case 'yes':
                case '':
                    flags[key] = true;
                    break;
                case 'false':
                case '0':
                case 'no':
                    flags[key] = false;
                    break;
                default:
                    // Omit keys with unrecognized values
                    break;
            }
        }
    }

    return flags;
}

export { parseBooleanFlags };

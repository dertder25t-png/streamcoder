import { parse } from 'querystring';

export function parseDotEnv(content: string): Record<string, string> {
    const lines = content.split(/\r?\n/);
    const result: Record<string, string> = {};

    lines.forEach(line => {
        line = line.trim();
        if (line === '' || line.startsWith('#')) return; // Skip blank lines and comments

        const match = line.match(/^([^=#]+)\s*=\s*(['"])(.*?)\2$/);
        if (match) {
            const [_, key, _, value] = match;
            result[key.trim()] = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
        } else {
            const [key, value] = line.split('=', 2);
            result[key.trim()] = value ? value.trim() : '';
        }
    });

    return result;
}

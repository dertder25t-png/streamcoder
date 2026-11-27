import { parse } from 'node:querystring';

export function safeParseJson<T>(raw: string, validator: (val: unknown) => val is T): T | null {
    try {
        const parsed = JSON.parse(raw);
        if (validator(parsed)) {
            return parsed;
        }
    } catch (e) {
        // JSON.parse throws a syntax error if the string is not valid JSON
    }
    return null;
}

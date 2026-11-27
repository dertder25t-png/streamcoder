export function safeParseJson<T>(raw: string, validator: (val: unknown) => val is T): T | null {
    try {
        const parsed = JSON.parse(raw);
        return validator(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

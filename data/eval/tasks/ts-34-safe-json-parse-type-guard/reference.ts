export function safeParseJson<T>(raw: string, validator: (val: unknown) => val is T): T | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return validator(parsed) ? parsed : null;
}

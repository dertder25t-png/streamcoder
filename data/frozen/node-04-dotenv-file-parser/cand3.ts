export function parseDotEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine === '' || trimmedLine.startsWith('#')) continue;

    const parts = trimmedLine.split('=');
    if (parts.length < 2) continue;

    let key = parts[0].trim();
    let value = parts.slice(1).join('=').trim();

    if (value.startsWith('"')) {
      value = value.slice(1, -1).replace(/\\n/g, '\n').replace(/\\r/g, '\r');
    } else if (value.startsWith("'")) {
      value = value.slice(1, -1).replace(/\\n/g, '\\n').replace(/\\r/g, '\\r');
    } else {
      value = value.trim();
    }

    result[key] = value;
  }

  return result;
}

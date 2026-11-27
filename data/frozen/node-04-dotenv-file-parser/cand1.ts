type DotEnvPair = {
  key: string;
  value: string;
};

export function parseDotEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine === '' || trimmedLine.startsWith('#')) continue;

    const [key, value] = parsePair(trimmedLine);
    if (key) result[key] = value;
  }

  return result;
}

function parsePair(line: string): DotEnvPair | [undefined, undefined] {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (!match) return [undefined, undefined];

  let key = match[1].trim();
  let value = match[2].trim();

  if (value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1).replace(/\\n/g, '\n').replace(/\\r/g, '\r');
  } else if (value.startsWith("'") && value.endsWith("'")) {
    value = value.slice(1, -1);
  } else {
    value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
  }

  return [key, value];
}

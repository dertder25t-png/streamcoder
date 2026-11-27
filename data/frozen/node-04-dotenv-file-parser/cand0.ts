export function parseDotEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split(/\r?\n/);

  lines.forEach(line => {
    line = line.trim();

    if (line === '' || line.startsWith('#')) {
      return; // Skip blank lines and comments
    }

    const commentIndex = line.indexOf('#');
    if (commentIndex !== -1) {
      line = line.substring(0, commentIndex).trim(); // Strip inline comments
    }

    const [key, value] = line.split(/=(.+)/, 2);
    if (!key) {
      return; // Skip lines without a key
    }

    const trimmedKey = key.trim();
    if (trimmedKey.startsWith('export ')) {
      trimmedKey = trimmedKey.substring(7).trim(); // Remove 'export ' prefix
    }

    let trimmedValue = value ? value.trim() : '';
    if (trimmedValue.startsWith('"')) {
      trimmedValue = trimmedValue.substring(1, trimmedValue.length - 1); // Remove surrounding quotes
      trimmedValue = trimmedValue.replace(/\\n/g, '\n'); // Expand \n to real newlines
    } else if (trimmedValue.startsWith("'")) {
      trimmedValue = trimmedValue.substring(1, trimmedValue.length - 1); // Remove surrounding quotes
      trimmedValue = trimmedValue.replace(/\\n/g, '\\n'); // Treat \n literally
    } else {
      trimmedValue = trimmedValue.trim(); // Trim surrounding whitespace
    }

    result[trimmedKey] = trimmedValue;
  });

  return result;
}

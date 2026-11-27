// csv-parser.ts
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Escaped double quote inside a quoted field
        field += line[i];
        i++; // Skip the next double quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (line[i] === ',' && !inQuotes) {
      result.push(field);
      field = '';
    } else {
      field += line[i];
    }
  }

  result.push(field);
  return result;
}

export { parseCsvLine };

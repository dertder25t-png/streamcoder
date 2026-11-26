export function formatCsvRow(cells: readonly (string | number | boolean | null | undefined)[]): string {
  return cells
    .map((c) => {
      if (c === null || c === undefined) return "";
      let s: string;
      if (typeof c === "string") {
        s = /^[=+\-@]/.test(c) ? `'${c}` : c;
      } else {
        s = String(c);
      }
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(",");
}

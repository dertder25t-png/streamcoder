/**
 * Serializes a single RFC 4180 CSV row and neutralizes spreadsheet formula injection.
 * @param cells - Array of cells to serialize.
 * @returns A string representing the CSV row.
 */
export function formatCsvRow(cells: readonly (string | number | boolean | null | undefined)[]): string {
    return cells.map(cell => {
        if (cell === null || cell === undefined) {
            return '';
        }
        if (typeof cell === 'number' || typeof cell === 'boolean') {
            return String(cell);
        }
        if (cell.startsWith('=') || cell.startsWith('+') || cell.startsWith('-') || cell.startsWith('@')) {
            cell = `'${cell}`;
        }
        return `"${cell.replace(/"/g, '""')}"`;
    }).join(',');
}

import React, { useState, useCallback, useMemo } from 'react';

type Row = { id: string; name: string };

interface PaginatedSelectorTableProps {
  rows: Row[];
  pageSize: number;
  onSelectionChange: (ids: string[]) => void;
}

const PaginatedSelectorTable: React.FC<PaginatedSelectorTableProps> = ({ rows, pageSize, onSelectionChange }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const totalRows = rows.length;
  const totalPages = Math.ceil(totalRows / pageSize);

  const currentRows = useMemo(() => rows.slice((currentPage - 1) * pageSize, currentPage * pageSize), [rows, currentPage, pageSize]);

  const handleSelectAllPage = useCallback(() => {
    if (currentRows.every(row => selectedIds.includes(row.id))) {
      setSelectedIds(currentRows.filter(row => !selectedIds.includes(row.id)).map(row => row.id));
    } else {
      setSelectedIds([...selectedIds, ...currentRows.map(row => row.id)]);
    }
  }, [currentRows, selectedIds]);

  const handleSelectRow = useCallback((id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  }, [selectedIds]);

  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
    // Ensure selected rows persist across pages
    const newSelectedIds = currentRows.filter(row => selectedIds.includes(row.id)).map(row => row.id);
    setSelectedIds(newSelectedIds);
    onSelectionChange(newSelectedIds);
  }, [currentRows, selectedIds, onSelectionChange]);

  const handleClearAll = useCallback(() => {
    setSelectedIds([]);
    onSelectionChange([]);
  }, [onSelectionChange]);

  const isPageSelected = currentRows.every(row => selectedIds.includes(row.id));
  const isAnyPageSelected = selectedIds.length > 0;

  return (
    <div>
      <div>
        <input
          type="checkbox"
          checked={isPageSelected}
          onChange={handleSelectAllPage}
          aria-label={`Select page ${currentPage}`}
        />
        <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>Prev</button>
        <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>Next</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Select</th>
            <th>Name</th>
          </tr>
        </thead>
        <tbody>
          {currentRows.map(row => (
            <tr key={row.id}>
              <td>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(row.id)}
                  onChange={() => handleSelectRow(row.id)}
                  aria-label={`Select ${row.name}`}
                />
              </td>
              <td>{row.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={handleClearAll} disabled={!isAnyPageSelected}>
        Clear all ({selectedIds.length})
      </button>
    </div>
  );
};

export { PaginatedSelectorTable };

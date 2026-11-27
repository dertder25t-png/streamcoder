import React, { useState, useMemo, useCallback } from 'react';

interface Row {
  id: string;
  name: string;
}

interface PaginatedSelectorTableProps {
  rows: Row[];
  pageSize: number;
  onSelectionChange: (ids: string[]) => void;
}

const PaginatedSelectorTable: React.FC<PaginatedSelectorTableProps> = ({ rows, pageSize, onSelectionChange }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const totalPages = useMemo(() => Math.ceil(rows.length / pageSize), [rows, pageSize]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleSelectRow = useCallback((id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  }, [selectedIds]);

  const handleSelectPage = useCallback(() => {
    const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const pageRowIds = pageRows.map(row => row.id);
    const newSelectedIds = pageRowIds.filter(id => !selectedIds.includes(id));
    setSelectedIds([...selectedIds, ...newSelectedIds]);
  }, [currentPage, rows, selectedIds]);

  const handleClearAll = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const currentRows = useMemo(() => rows.slice((currentPage - 1) * pageSize, currentPage * pageSize), [rows, currentPage, pageSize]);

  return (
    <div>
      <div>
        <input
          type="checkbox"
          checked={currentRows.every(row => selectedIds.includes(row.id))}
          onChange={handleSelectPage}
          aria-label={`Select page ${currentPage}`}
        />
        {currentRows.map((row, index) => (
          <label key={row.id}>
            <input
              type="checkbox"
              checked={selectedIds.includes(row.id)}
              onChange={() => handleSelectRow(row.id)}
              aria-label={`Select ${row.name}`}
            />
            {row.name}
          </label>
        ))}
      </div>
      <button
        onClick={() => handlePageChange(Math.max(currentPage - 1, 1))}
        disabled={currentPage === 1}
        aria-label="prev"
      >
        Prev
      </button>
      <span>{currentPage} of {totalPages}</span>
      <button
        onClick={() => handlePageChange(Math.min(currentPage + 1, totalPages))}
        disabled={currentPage === totalPages}
        aria-label="next"
      >
        Next
      </button>
      <button onClick={handleClearAll} aria-label={`Clear all (${selectedIds.length})`}>
        Clear all ({selectedIds.length})
      </button>
    </div>
  );
};

export { PaginatedSelectorTable };

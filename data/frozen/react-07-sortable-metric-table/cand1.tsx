import React, { useState } from 'react';

interface Column {
  key: string;
  label: string;
  numeric?: boolean;
}

interface Row {
  [key: string]: string | number;
}

interface SortState {
  column: string | null;
  direction: 'asc' | 'desc' | 'none';
}

const SortableTable: React.FC<{ rows: Row[]; columns: Column[] }> = ({ rows, columns }) => {
  const [sortState, setSortState] = useState<SortState>({ column: null, direction: 'none' });

  const handleClick = (key: string) => {
    if (sortState.column === key) {
      setSortState((prevState) => ({
        ...prevState,
        direction: prevState.direction === 'asc' ? 'desc' : prevState.direction === 'desc' ? 'none' : 'asc',
      }));
    } else {
      setSortState({ column: key, direction: 'asc' });
    }
  };

  const sortedRows = [...rows].sort((a, b) => {
    const { column, direction } = sortState;
    if (!column) return 0;

    const valueA = a[column];
    const valueB = b[column];

    if (direction === 'asc') {
      if (columns.find((col) => col.key === column)?.numeric) {
        return (valueA as number) - (valueB as number);
      } else {
        return (valueA as string).localeCompare(valueB as string, 'en', { numeric: true, sensitivity: 'base' });
      }
    } else if (direction === 'desc') {
      if (columns.find((col) => col.key === column)?.numeric) {
        return (valueB as number) - (valueA as number);
      } else {
        return (valueB as string).localeCompare(valueA as string, 'en', { numeric: true, sensitivity: 'base' });
      }
    } else {
      return 0;
    }
  });

  return (
    <table>
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={column.key}
              onClick={() => handleClick(column.key)}
              aria-sort={sortState.column === column.key ? sortState.direction : 'none'}
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sortedRows.map((row, index) => (
          <tr key={index}>
            {columns.map((column) => (
              <td key={column.key}>{row[column.key]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export { SortableTable };

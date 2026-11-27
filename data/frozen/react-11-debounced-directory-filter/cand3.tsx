import React, { useState, useEffect, useRef } from 'react';

const FilterableDirectory: React.FC<{
  entries: { id: string; name: string; department: string }[];
  delayMs?: number;
}> = ({ entries, delayMs = 250 }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredEntries, setFilteredEntries] = useState(entries);
  const debounceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const handleDebounce = () => {
      setFilteredEntries(
        entries.filter(entry =>
          entry.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entry.department.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    };

    if (searchTerm) {
      debounceTimerRef.current = setTimeout(handleDebounce, delayMs);
    } else {
      setFilteredEntries(entries);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm, entries, delayMs]);

  const handleClear = () => {
    setSearchTerm('');
    setFilteredEntries(entries);
  };

  return (
    <div>
      <input
        type="text"
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        placeholder="Search people..."
      />
      <button onClick={handleClear}>Clear</button>
      <ul>
        {filteredEntries.length === 0 ? (
          <li>No matching people</li>
        ) : (
          filteredEntries.map(entry => (
            <li key={entry.id}>
              {entry.name} - {entry.department}
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

export { FilterableDirectory };

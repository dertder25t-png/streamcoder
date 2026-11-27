import React, { useState, useEffect } from 'react';

interface Option {
  id: string;
  label: string;
  disabled?: boolean;
}

interface SelectAllGroupProps {
  options: Option[];
  selectedIds: string[];
  onChange: (nextIds: string[]) => void;
}

export const SelectAllGroup: React.FC<SelectAllGroupProps> = ({ options, selectedIds, onChange }) => {
  const [allSelected, setAllSelected] = useState(false);
  const [someSelected, setSomeSelected] = useState(false);

  useEffect(() => {
    const allIds = options.map(option => option.id);
    const allEnabledSelected = allIds.every(id => selectedIds.includes(id));
    const someEnabledSelected = allIds.some(id => selectedIds.includes(id));

    setAllSelected(allEnabledSelected);
    setSomeSelected(someEnabledSelected);
  }, [options, selectedIds]);

  const handleSelectAllChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    if (checked) {
      const enabledIds = options.filter(option => !option.disabled).map(option => option.id);
      onChange(enabledIds);
    } else {
      onChange([]);
    }
  };

  const handleOptionChange = (id: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    const nextIds = checked ? [...selectedIds, id] : selectedIds.filter(nextId => nextId !== id);
    onChange(nextIds);
  };

  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={allSelected}
          indeterminate={someSelected}
          onChange={handleSelectAllChange}
          aria-label="Select all"
        />
        Select all
      </label>
      {options.map(option => (
        <div key={option.id}>
          <label>
            <input
              type="checkbox"
              checked={selectedIds.includes(option.id)}
              onChange={handleOptionChange(option.id)}
              disabled={option.disabled}
            />
            {option.label}
          </label>
        </div>
      ))}
    </div>
  );
};

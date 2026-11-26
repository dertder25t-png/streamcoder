import { useEffect, useRef } from "react";

export type Option = { id: string; label: string; disabled?: boolean };

export function SelectAllGroup({
  options,
  selectedIds,
  onChange,
}: {
  options: Option[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
}) {
  const master = useRef<HTMLInputElement>(null);
  const enabled = options.filter((o) => !o.disabled);
  const selectedEnabled = enabled.filter((o) => selectedIds.includes(o.id));
  const all = enabled.length > 0 && selectedEnabled.length === enabled.length;
  const some = selectedEnabled.length > 0 && !all;

  useEffect(() => {
    if (master.current) master.current.indeterminate = some;
  }, [some]);

  const toggleAll = () => {
    const enabledIds = enabled.map((o) => o.id);
    if (all) onChange(selectedIds.filter((id) => !enabledIds.includes(id)));
    else onChange([...selectedIds, ...enabledIds.filter((id) => !selectedIds.includes(id))]);
  };

  const toggleOne = (id: string) =>
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);

  return (
    <div>
      <label>
        <input type="checkbox" ref={master} checked={all} onChange={toggleAll} />
        Select all
      </label>
      {options.map((o) => (
        <label key={o.id}>
          <input
            type="checkbox"
            checked={selectedIds.includes(o.id)}
            disabled={o.disabled}
            onChange={() => toggleOne(o.id)}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

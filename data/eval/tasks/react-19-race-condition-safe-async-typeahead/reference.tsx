import { useEffect, useId, useState } from "react";

export function AsyncAutocomplete({
  fetchSuggestions,
  onSelect,
}: {
  fetchSuggestions: (query: string, signal: AbortSignal) => Promise<string[]>;
  onSelect: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();

  useEffect(() => {
    if (query === "") {
      setOptions([]);
      return;
    }
    const controller = new AbortController();
    fetchSuggestions(query, controller.signal).then(
      (result) => {
        if (controller.signal.aborted) return;
        setOptions(result);
        setActive(-1);
        setOpen(true);
      },
      () => {},
    );
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const onKeyDown = (e: { key: string; preventDefault: () => void }) => {
    if (e.key === "ArrowDown" && options.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % options.length);
    } else if (e.key === "ArrowUp" && options.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a <= 0 ? options.length - 1 : a - 1));
    } else if (e.key === "Enter" && open && active >= 0 && options[active] !== undefined) {
      e.preventDefault();
      onSelect(options[active]);
      setOpen(false);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showList = open && options.length > 0;
  return (
    <div>
      <input
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul role="listbox" id={listId}>
          {options.map((o, i) => (
            <li key={o} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

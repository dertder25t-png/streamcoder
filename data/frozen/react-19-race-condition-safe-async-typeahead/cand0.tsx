import React, { useState, useRef, useEffect } from 'react';

interface AsyncAutocompleteProps {
  fetchSuggestions: (query: string, signal: AbortSignal) => Promise<string[]>;
  onSelect: (suggestion: string) => void;
}

const AsyncAutocomplete: React.FC<AsyncAutocompleteProps> = ({ fetchSuggestions, onSelect }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortController = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cleanup previous request
    if (abortController.current) {
      abortController.current.abort();
    }
    abortController.current = new AbortController();

    const fetch = async () => {
      try {
        const result = await fetchSuggestions(query, abortController.current.signal);
        if (abortController.current.signal.aborted) return;
        setSuggestions(result);
        setActiveIndex(null);
      } catch (error) {
        if (error.name === 'AbortError') return;
        console.error('Error fetching suggestions:', error);
      }
    };

    const debouncedFetch = setTimeout(fetch, 1000);
    return () => {
      clearTimeout(debouncedFetch);
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, [query, fetchSuggestions]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = query;
    }
  }, [query]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((prev) => (prev === null ? 0 : (prev + 1) % suggestions.length));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((prev) => (prev === null ? suggestions.length - 1 : (prev - 1 + suggestions.length) % suggestions.length));
        break;
      case 'Enter':
        event.preventDefault();
        if (activeIndex !== null && activeIndex < suggestions.length) {
          onSelect(suggestions[activeIndex]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        setActiveIndex(null);
        break;
      default:
        break;
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={suggestions.length > 0}
        aria-activedescendant={activeIndex !== null ? `suggestion-${activeIndex}` : undefined}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      {suggestions.length > 0 && (
        <ul role="listbox">
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion}
              role="option"
              id={`suggestion-${index}`}
              aria-selected={index === activeIndex}
              onClick={() => {
                onSelect(suggestion);
                setActiveIndex(null);
              }}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export { AsyncAutocomplete };

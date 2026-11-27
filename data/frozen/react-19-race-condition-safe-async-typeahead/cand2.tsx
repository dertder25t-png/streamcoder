import React, { useState, useRef, useEffect } from 'react';

interface AsyncAutocompleteProps {
  fetchSuggestions: (query: string, signal: AbortSignal) => Promise<string[]>;
  onSelect: (suggestion: string) => void;
}

const AsyncAutocomplete: React.FC<AsyncAutocompleteProps> = ({ fetchSuggestions, onSelect }) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (inputValue) {
      const controller = new AbortController();
      setAbortController(controller);

      const fetchData = async () => {
        try {
          const result = await fetchSuggestions(inputValue, controller.signal);
          if (controller.signal.aborted) return;
          setSuggestions(result);
          setActiveIndex(null);
        } catch (error) {
          if (error.name === 'AbortError') return;
          console.error('Error fetching suggestions:', error);
        }
      };

      const timeoutId = setTimeout(fetchData, 1000);

      return () => {
        clearTimeout(timeoutId);
        if (controller.signal.aborted) return;
        controller.abort();
      };
    } else {
      setSuggestions([]);
      setActiveIndex(null);
    }
  }, [inputValue, fetchSuggestions]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

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
          setInputValue('');
          setSuggestions([]);
          setActiveIndex(null);
        }
        break;
      case 'Escape':
        event.preventDefault();
        setInputValue('');
        setSuggestions([]);
        setActiveIndex(null);
        break;
      default:
        break;
    }
  };

  return (
    <div>
      <input
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={suggestions.length > 0}
        aria-activedescendant={activeIndex !== null ? `suggestion-${activeIndex}` : undefined}
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        ref={inputRef}
      />
      {suggestions.length > 0 && (
        <ul role="listbox">
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion}
              role="option"
              id={`suggestion-${index}`}
              aria-selected={activeIndex === index}
              onClick={() => {
                onSelect(suggestion);
                setInputValue('');
                setSuggestions([]);
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

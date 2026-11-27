import React, { useState, useEffect, useRef } from 'react';

type AsyncAutocompleteProps = {
  fetchSuggestions: (query: string, signal: AbortSignal) => Promise<string[]>;
  onSelect: (suggestion: string) => void;
};

const AsyncAutocomplete: React.FC<AsyncAutocompleteProps> = ({ fetchSuggestions, onSelect }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [signal, setSignal] = useState<AbortSignal | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (signal) {
        signal.abort();
      }
    };
  }, []);

  useEffect(() => {
    const currentSignal = new AbortController().signal;
    setSignal(currentSignal);
    if (query) {
      setSuggestions([]);
      setActiveIndex(null);
      fetchSuggestions(query, currentSignal).then((newSuggestions) => {
        if (!currentSignal.aborted) {
          setSuggestions(newSuggestions);
        }
      });
    } else {
      setSuggestions([]);
      setActiveIndex(null);
    }
  }, [query, fetchSuggestions]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((prevIndex) => {
          if (prevIndex === null) {
            return 0;
          } else if (prevIndex < suggestions.length - 1) {
            return prevIndex + 1;
          } else {
            return 0;
          }
        });
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((prevIndex) => {
          if (prevIndex === null) {
            return suggestions.length - 1;
          } else if (prevIndex > 0) {
            return prevIndex - 1;
          } else {
            return suggestions.length - 1;
          }
        });
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

  const handleOptionClick = (index: number) => {
    setActiveIndex(index);
    onSelect(suggestions[index]);
  };

  return (
    <div>
      <input
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-activedescendant={activeIndex !== null ? `option-${activeIndex}` : undefined}
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        ref={inputRef}
      />
      {suggestions.length > 0 && (
        <ul role="listbox">
          {suggestions.map((suggestion, index) => (
            <li
              key={index}
              role="option"
              id={`option-${index}`}
              aria-selected={activeIndex === index ? 'true' : 'false'}
              onClick={() => handleOptionClick(index)}
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

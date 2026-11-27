import React, { useState, useRef } from 'react';

interface TagChipsInputProps {
  value: string[];
  onChange: (next: string[]) => void;
}

const TagChipsInput: React.FC<TagChipsInputProps> = ({ value, onChange }) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      const trimmedValue = inputValue.trim();
      if (trimmedValue && !value.some(tag => tag.toLowerCase() === trimmedValue.toLowerCase())) {
        onChange([...value, trimmedValue]);
      }
      setInputValue('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onChange(value.filter(tag => tag.toLowerCase() !== tagToRemove.toLowerCase()));
  };

  const handleBackspace = () => {
    if (inputValue === '') {
      const lastTag = value[value.length - 1];
      if (lastTag) {
        handleRemoveTag(lastTag);
      }
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onKeyPress={handleBackspace}
        placeholder="Add tags..."
      />
      <div>
        {value.map((tag, index) => (
          <span key={index} style={{ display: 'inline-block', margin: '2px' }}>
            {tag}
            <button
              onClick={() => handleRemoveTag(tag)}
              aria-label={`Remove ${tag}`}
              style={{ marginLeft: '4px', cursor: 'pointer' }}
            >
              X
            </button>
          </span>
        ))}
      </div>
    </div>
  );
};

export { TagChipsInput };

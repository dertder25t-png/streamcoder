import React, { useState } from 'react';

interface LimitedTextAreaProps {
  maxLength: number;
  warnAt: number;
  onSubmit: (value: string) => void;
}

const LimitedTextArea: React.FC<LimitedTextAreaProps> = ({ maxLength, warnAt, onSubmit }) => {
  const [value, setValue] = useState('');

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const inputValue = event.target.value;
    setValue(inputValue);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedValue = value.trim();
    if (trimmedValue && trimmedValue.length <= maxLength) {
      onSubmit(trimmedValue);
    }
  };

  const remaining = maxLength - value.length;
  const counterClass = remaining <= 0 ? 'error' : remaining <= warnAt ? 'warning' : '';

  return (
    <form onSubmit={handleSubmit}>
      <textarea value={value} onChange={handleChange} maxLength={maxLength} />
      <div data-state={counterClass}>
        {`${remaining} characters left`}
      </div>
      <button type="submit" disabled={value.trim().length === 0 || value.length > maxLength}>
        Submit
      </button>
    </form>
  );
};

export { LimitedTextArea };

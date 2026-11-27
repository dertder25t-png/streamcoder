import React, { useState } from 'react';

interface LimitedTextAreaProps {
  maxLength: number;
  warnAt: number;
  onSubmit: (value: string) => void;
}

const LimitedTextArea: React.FC<LimitedTextAreaProps> = ({ maxLength, warnAt, onSubmit }) => {
  const [value, setValue] = useState('');

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.target.value);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (value.trim() && value.length <= maxLength) {
      onSubmit(value);
    }
  };

  const remaining = maxLength - value.length;
  const counterClass = remaining <= 0 ? 'error' : remaining <= warnAt ? 'warning' : '';

  return (
    <form onSubmit={handleSubmit}>
      <textarea value={value} onChange={handleChange} />
      <div>
        {remaining} characters left
        <span data-state={counterClass}>{remaining <= 0 ? ' (exceeded)' : ''}</span>
      </div>
      <button type="submit" disabled={value.trim() === '' || value.length > maxLength}>
        Submit
      </button>
    </form>
  );
};

export { LimitedTextArea };

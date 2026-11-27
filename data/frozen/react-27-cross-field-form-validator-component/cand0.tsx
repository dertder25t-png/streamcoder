import React, { useState, useRef, useEffect } from 'react';

interface DateRangeFormProps {
  onSubmit: (values: { startDate: string; endDate: string; label: string }) => void;
}

const DateRangeForm: React.FC<DateRangeFormProps> = ({ onSubmit }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [label, setLabel] = useState('');
  const [startDateError, setStartDateError] = useState('');
  const [endDateError, setEndDateError] = useState('');
  const [labelError, setLabelError] = useState('');
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (endDate && startDate && new Date(endDate) < new Date(startDate)) {
      setEndDateError('End date must be on or after start date');
    } else {
      setEndDateError('');
    }
  }, [startDate, endDate]);

  const validateField = (field: 'startDate' | 'endDate' | 'label') => {
    switch (field) {
      case 'startDate':
        setStartDateError(startDate ? '' : 'Start date is required');
        break;
      case 'endDate':
        setEndDateError(endDate ? '' : 'End date is required');
        break;
      case 'label':
        setLabelError(label ? '' : 'Label is required');
        break;
      default:
        break;
    }
  };

  const handleBlur = (field: 'startDate' | 'endDate' | 'label') => {
    validateField(field);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    validateField('startDate');
    validateField('endDate');
    validateField('label');

    if (!startDateError && !endDateError && !labelError) {
      onSubmit({ startDate, endDate, label });
    } else {
      const firstInvalidInput = startDateError ? startDateRef : endDateError ? endDateRef : labelRef;
      firstInvalidInput.current?.focus();
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="startDate">Start date</label>
        <input
          type="date"
          id="startDate"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          onBlur={() => handleBlur('startDate')}
          aria-describedby={startDateError ? 'startDateError' : ''}
        />
        {startDateError && <div id="startDateError" role="alert">{startDateError}</div>}
      </div>
      <div>
        <label htmlFor="endDate">End date</label>
        <input
          type="date"
          id="endDate"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          onBlur={() => handleBlur('endDate')}
          aria-describedby={endDateError ? 'endDateError' : ''}
        />
        {endDateError && <div id="endDateError" role="alert">{endDateError}</div>}
      </div>
      <div>
        <label htmlFor="label">Label</label>
        <input
          type="text"
          id="label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => handleBlur('label')}
          aria-describedby={labelError ? 'labelError' : ''}
        />
        {labelError && <div id="labelError" role="alert">{labelError}</div>}
      </div>
      <button type="submit">Submit</button>
    </form>
  );
};

export { DateRangeForm };

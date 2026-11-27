import React, { useState, useRef, useEffect } from 'react';

type DateRangeFormProps = {
  onSubmit: (startDate: Date, endDate: Date, label: string) => void;
};

const DateRangeForm: React.FC<DateRangeFormProps> = ({ onSubmit }) => {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [label, setLabel] = useState<string>('');
  const [errors, setErrors] = useState<{
    startDate?: string;
    endDate?: string;
    label?: string;
  }>({});

  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (startDate && endDate && startDate > endDate) {
      setErrors((prevErrors) => ({
        ...prevErrors,
        endDate: 'End date must be on or after Start date',
      }));
    } else {
      setErrors((prevErrors) => ({
        ...prevErrors,
        endDate: undefined,
      }));
    }
  }, [startDate, endDate]);

  const validateForm = () => {
    const newErrors: { startDate?: string; endDate?: string; label?: string } = {};

    if (!startDate) {
      newErrors.startDate = 'Start date is required';
    }

    if (!endDate) {
      newErrors.endDate = 'End date is required';
    }

    if (!label) {
      newErrors.label = 'Label is required';
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (validateForm()) {
      onSubmit(startDate as Date, endDate as Date, label);
    }
  };

  const handleBlur = (field: string) => {
    if (field === 'startDate' && endDate && startDate > endDate) {
      setErrors((prevErrors) => ({
        ...prevErrors,
        endDate: 'End date must be on or after Start date',
      }));
    } else {
      setErrors((prevErrors) => ({
        ...prevErrors,
        [field]: undefined,
      }));
    }
  };

  const focusFirstInvalidInput = () => {
    if (errors.startDate) {
      startDateRef.current?.focus();
    } else if (errors.endDate) {
      endDateRef.current?.focus();
    } else if (errors.label) {
      labelRef.current?.focus();
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="start-date">Start date</label>
        <input
          id="start-date"
          type="date"
          value={startDate ? startDate.toISOString().split('T')[0] : ''}
          onChange={(e) => {
            const newDate = new Date(e.target.value);
            setStartDate(newDate);
            setErrors((prevErrors) => ({
              ...prevErrors,
              endDate: undefined,
            }));
          }}
          onBlur={() => handleBlur('startDate')}
          aria-describedby={errors.startDate ? 'start-date-error' : undefined}
        />
        {errors.startDate && <p id="start-date-error">{errors.startDate}</p>}
      </div>
      <div>
        <label htmlFor="end-date">End date</label>
        <input
          id="end-date"
          type="date"
          value={endDate ? endDate.toISOString().split('T')[0] : ''}
          onChange={(e) => {
            const newDate = new Date(e.target.value);
            setEndDate(newDate);
          }}
          onBlur={() => handleBlur('endDate')}
          aria-describedby={errors.endDate ? 'end-date-error' : undefined}
        />
        {errors.endDate && <p id="end-date-error">{errors.endDate}</p>}
      </div>
      <div>
        <label htmlFor="label">Label</label>
        <input
          id="label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => handleBlur('label')}
          aria-describedby={errors.label ? 'label-error' : undefined}
        />
        {errors.label && <p id="label-error">{errors.label}</p>}
      </div>
      <button type="submit" name="submit">
        Submit
      </button>
    </form>
  );
};

export { DateRangeForm };

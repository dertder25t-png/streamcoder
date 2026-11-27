import React, { useState, useRef } from 'react';

interface DateRangeFormProps {
  onSubmit: (startDate: string, endDate: string, label: string) => void;
}

const DateRangeForm: React.FC<DateRangeFormProps> = ({ onSubmit }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [label, setLabel] = useState('');
  const [errors, setErrors] = useState<{ startDate?: string; endDate?: string; label?: string }>({});
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);

  const validate = () => {
    const newErrors: { startDate?: string; endDate?: string; label?: string } = {};

    if (!startDate) newErrors.startDate = 'Start date is required';
    if (!endDate) newErrors.endDate = 'End date is required';
    if (!label) newErrors.label = 'Label is required';

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      newErrors.startDate = 'Start date must be before or equal to End date';
      newErrors.endDate = 'End date must be after or equal to Start date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(startDate, endDate, label);
    } else {
      const firstInvalidRef = Object.keys(errors).findKey((key) => !!errors[key]);
      const refs = { startDate: startDateRef, endDate: endDateRef, label: labelRef } as { [key: string]: React.RefObject<HTMLInputElement> };
      refs[firstInvalidRef]?.current?.focus();
    }
  };

  const handleBlur = (field: 'startDate' | 'endDate' | 'label') => {
    validate();
  };

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="startDate">Start date</label>
      <input
        type="date"
        id="startDate"
        name="startDate"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        onBlur={() => handleBlur('startDate')}
        aria-describedby="startDateError"
        ref={startDateRef}
      />
      {errors.startDate && <div id="startDateError">{errors.startDate}</div>}

      <label htmlFor="endDate">End date</label>
      <input
        type="date"
        id="endDate"
        name="endDate"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
        onBlur={() => handleBlur('endDate')}
        aria-describedby="endDateError"
        ref={endDateRef}
      />
      {errors.endDate && <div id="endDateError">{errors.endDate}</div>}

      <label htmlFor="label">Label</label>
      <input
        type="text"
        id="label"
        name="label"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => handleBlur('label')}
        aria-describedby="labelError"
        ref={labelRef}
      />
      {errors.label && <div id="labelError">{errors.label}</div>}

      <button type="submit" name="Submit">
        Submit
      </button>
    </form>
  );
};

export { DateRangeForm };

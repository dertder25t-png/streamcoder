import React, { useState, useEffect } from 'react';

interface TemperaturePairProps {
  celsius: number;
  fahrenheit: number;
  onChange: (celsius: number, fahrenheit: number) => void;
}

const TemperaturePair: React.FC<TemperaturePairProps> = ({ celsius, fahrenheit, onChange }) => {
  const [celsiusInput, setCelsiusInput] = useState<string>(celsius.toString());
  const [fahrenheitInput, setFahrenheitInput] = useState<string>(fahrenheit.toString());

  useEffect(() => {
    if (celsiusInput !== celsius.toString()) {
      setCelsiusInput(celsius.toString());
    }
  }, [celsius]);

  useEffect(() => {
    if (fahrenheitInput !== fahrenheit.toString()) {
      setFahrenheitInput(fahrenheit.toString());
    }
  }, [fahrenheit]);

  const handleCelsiusChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setCelsiusInput(value);
    if (value === '' || value === '-') {
      onChange(value === '' ? 0 : -Infinity, fahrenheit);
    } else {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        onChange(parsed, (parsed * 9 / 5) + 32);
      }
    }
  };

  const handleFahrenheitChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setFahrenheitInput(value);
    if (value === '' || value === '-') {
      onChange(celsius, value === '' ? 0 : -Infinity);
    } else {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        onChange((parsed - 32) * 5 / 9, parsed);
      }
    }
  };

  return (
    <div>
      <label>
        Celsius:
        <input
          type="text"
          value={celsiusInput}
          onChange={handleCelsiusChange}
          onBlur={() => onChange(parseFloat(celsiusInput), parseFloat(fahrenheitInput))}
        />
      </label>
      <label>
        Fahrenheit:
        <input
          type="text"
          value={fahrenheitInput}
          onChange={handleFahrenheitChange}
          onBlur={() => onChange(parseFloat(celsiusInput), parseFloat(fahrenheitInput))}
        />
      </label>
    </div>
  );
};

export { TemperaturePair };

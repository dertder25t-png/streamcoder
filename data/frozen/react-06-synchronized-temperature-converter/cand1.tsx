import React, { useState } from 'react';

interface TemperaturePairProps {
  initialCelsius?: number;
  initialFahrenheit?: number;
}

const TemperaturePair: React.FC<TemperaturePairProps> = ({ initialCelsius = 0, initialFahrenheit = 32 }) => {
  const [celsius, setCelsius] = useState<string>(initialCelsius.toString());
  const [fahrenheit, setFahrenheit] = useState<string>(initialFahrenheit.toString());

  const handleCelsiusChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setCelsius(value);
    if (value === '') {
      setFahrenheit('');
    } else {
      const celsiusValue = parseFloat(value);
      if (!isNaN(celsiusValue)) {
        setFahrenheit((celsiusValue * 9 / 5 + 32).toFixed(2));
      }
    }
  };

  const handleFahrenheitChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setFahrenheit(value);
    if (value === '') {
      setCelsius('');
    } else {
      const fahrenheitValue = parseFloat(value);
      if (!isNaN(fahrenheitValue)) {
        setCelsius((fahrenheitValue - 32) * 5 / 9).toFixed(2));
      }
    }
  };

  return (
    <div>
      <input
        type="text"
        value={celsius}
        onChange={handleCelsiusChange}
        placeholder="Celsius"
      />
      <input
        type="text"
        value={fahrenheit}
        onChange={handleFahrenheitChange}
        placeholder="Fahrenheit"
      />
    </div>
  );
};

export { TemperaturePair };

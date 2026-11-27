import React, { useState, useEffect } from 'react';

interface PasswordPolicyMeterProps {
  onValidChange: (isValid: boolean) => void;
}

const PasswordPolicyMeter: React.FC<PasswordPolicyMeterProps> = ({ onValidChange }) => {
  const [password, setPassword] = useState('');
  const [rules, setRules] = useState({
    length: false,
    uppercase: false,
    digit: false,
    symbol: false,
  });

  useEffect(() => {
    const isValid = Object.values(rules).every(Boolean);
    onValidChange(isValid);
  }, [rules, onValidChange]);

  const checkPassword = (password: string) => {
    const length = password.length >= 10;
    const uppercase = /[A-Z]/.test(password);
    const digit = /\d/.test(password);
    const symbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    setRules({
      length,
      uppercase,
      digit,
      symbol,
    });
  };

  useEffect(() => {
    checkPassword(password);
  }, [password]);

  return (
    <div>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        data-passed={password.length > 0 ? 'true' : 'false'}
      />
      <ul>
        <li data-passed={rules.length ? 'true' : 'false'}>At least 10 characters</li>
        <li data-passed={rules.uppercase ? 'true' : 'false'}>An uppercase letter</li>
        <li data-passed={rules.digit ? 'true' : 'false'}>A digit</li>
        <li data-passed={rules.symbol ? 'true' : 'false'}>A symbol</li>
      </ul>
    </div>
  );
};

export { PasswordPolicyMeter };

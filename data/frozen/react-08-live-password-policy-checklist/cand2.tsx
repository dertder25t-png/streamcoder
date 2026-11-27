import React, { useState, useEffect } from 'react';

interface PasswordPolicyMeterProps {
  onValidChange: (isValid: boolean) => void;
}

const PasswordPolicyMeter: React.FC<PasswordPolicyMeterProps> = ({ onValidChange }) => {
  const [password, setPassword] = useState('');
  const [isAtLeast10Chars, setIsAtLeast10Chars] = useState(false);
  const [hasUppercase, setHasUppercase] = useState(false);
  const [hasDigit, setHasDigit] = useState(false);
  const [hasSymbol, setHasSymbol] = useState(false);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const checkValidity = () => {
      const atLeast10Chars = password.length >= 10;
      const hasUppercase = /[A-Z]/.test(password);
      const hasDigit = /\d/.test(password);
      const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

      setIsAtLeast10Chars(atLeast10Chars);
      setHasUppercase(hasUppercase);
      setHasDigit(hasDigit);
      setHasSymbol(hasSymbol);

      const newIsValid = atLeast10Chars && hasUppercase && hasDigit && hasSymbol;
      if (newIsValid !== isValid) {
        setIsValid(newIsValid);
        onValidChange(newIsValid);
      }
    };

    checkValidity();
  }, [password, onValidChange]);

  return (
    <div>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        data-passed={isValid ? 'true' : 'false'}
      />
      <ul>
        <li data-passed={isAtLeast10Chars ? 'true' : 'false'}>
          At least 10 characters
        </li>
        <li data-passed={hasUppercase ? 'true' : 'false'}>
          Contains an uppercase letter
        </li>
        <li data-passed={hasDigit ? 'true' : 'false'}>
          Contains a digit
        </li>
        <li data-passed={hasSymbol ? 'true' : 'false'}>
          Contains a symbol
        </li>
      </ul>
    </div>
  );
};

export { PasswordPolicyMeter };

import React, { useState } from 'react';

interface PasswordPolicyMeterProps {
  onValidChange: (isValid: boolean) => void;
}

const PasswordPolicyMeter: React.FC<PasswordPolicyMeterProps> = ({ onValidChange }) => {
  const [password, setPassword] = useState('');
  const [isUppercase, setIsUppercase] = useState(false);
  const [hasDigit, setHasDigit] = useState(false);
  const [hasSymbol, setHasSymbol] = useState(false);
  const [lengthValid, setLengthValid] = useState(false);

  const validatePassword = (pwd: string) => {
    setIsUppercase(pwd.toUpperCase() !== pwd);
    setHasDigit(/\d/.test(pwd));
    setHasSymbol(/[^a-zA-Z0-9]/.test(pwd));
    setLengthValid(pwd.length >= 10);
  };

  const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const pwd = event.target.value;
    setPassword(pwd);
    validatePassword(pwd);

    const isValid = isUppercase && hasDigit && hasSymbol && lengthValid;
    onValidChange(isValid);
  };

  React.useEffect(() => {
    const isValid = isUppercase && hasDigit && hasSymbol && lengthValid;
    onValidChange(isValid);
  }, [isUppercase, hasDigit, hasSymbol, lengthValid, onValidChange]);

  return (
    <div>
      <input
        type="password"
        value={password}
        onChange={handlePasswordChange}
      />
      <ul>
        <li data-passed={isUppercase ? 'true' : 'false'}>At least one uppercase letter</li>
        <li data-passed={hasDigit ? 'true' : 'false'}>At least one digit</li>
        <li data-passed={hasSymbol ? 'true' : 'false'}>At least one symbol</li>
        <li data-passed={lengthValid ? 'true' : 'false'}>At least 10 characters</li>
      </ul>
    </div>
  );
};

export { PasswordPolicyMeter };

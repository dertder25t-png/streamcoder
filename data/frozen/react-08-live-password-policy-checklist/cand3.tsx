import React, { useState, useEffect } from 'react';

const PasswordPolicyMeter: React.FC<{ onValidChange: (valid: boolean) => void }> = ({ onValidChange }) => {
  const [password, setPassword] = useState('');
  const [valid, setValid] = useState(false);

  useEffect(() => {
    const checkPassword = (pwd: string): boolean => {
      const hasMinLength = pwd.length >= 10;
      const hasUpperCase = /[A-Z]/.test(pwd);
      const hasDigit = /\d/.test(pwd);
      const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);
      return hasMinLength && hasUpperCase && hasDigit && hasSymbol;
    };

    const newValid = checkPassword(password);
    if (newValid !== valid) {
      setValid(newValid);
      onValidChange(newValid);
    }
  }, [password, onValidChange, valid]);

  const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setPassword(event.target.value);
  };

  return (
    <div>
      <input
        type="password"
        value={password}
        onChange={handlePasswordChange}
        data-passed={valid ? 'true' : 'false'}
      />
      <ul>
        <li data-passed={password.length >= 10 ? 'true' : 'false'}>At least 10 characters</li>
        <li data-passed={/[A-Z]/.test(password) ? 'true' : 'false'}>An uppercase letter</li>
        <li data-passed={/\d/.test(password) ? 'true' : 'false'}>A digit</li>
        <li data-passed={/[!@#$%^&*(),.?":{}|<>]/.test(password) ? 'true' : 'false'}>A symbol</li>
      </ul>
    </div>
  );
};

export { PasswordPolicyMeter };

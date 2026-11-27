import React, { useState, useEffect, useRef } from 'react';

export const RevealableToken = ({ token }: { token: string }) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const toggleReveal = () => {
    setIsRevealed(!isRevealed);
  };

  const handleCopy = async () => {
    if (token) {
      try {
        await navigator.clipboard.writeText(token);
        setIsRevealed(false);
        copyTimerRef.current = window.setTimeout(() => {
          setIsRevealed(true);
        }, 2000);
      } catch (err) {
        console.error('Failed to copy token: ', err);
      }
    }
  };

  const displayedToken = isRevealed ? token : token.replace(/./g, '•');

  return (
    <div>
      <p>{displayedToken || 'No token provided'}</p>
      {token && (
        <button onClick={toggleReveal}>
          {isRevealed ? 'Hide' : 'Show'}
        </button>
      )}
      {token && isRevealed && (
        <button onClick={handleCopy}>Copy</button>
      )}
    </div>
  );
};

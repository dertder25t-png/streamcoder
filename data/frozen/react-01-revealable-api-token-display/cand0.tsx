import React, { useState, useEffect, useRef } from 'react';

interface RevealableTokenProps {
  token: string;
}

const RevealableToken: React.FC<RevealableTokenProps> = ({ token }) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setIsRevealed(false);
      copyTimerRef.current = window.setTimeout(() => {
        setIsRevealed(true);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy token: ', err);
    }
  };

  const toggleReveal = () => {
    setIsRevealed(!isRevealed);
  };

  if (!token) {
    return <div>No token provided</div>;
  }

  return (
    <div>
      <button onClick={toggleReveal}>
        {isRevealed ? 'Hide' : 'Show'}
      </button>
      <button onClick={handleCopy} disabled={!isRevealed}>
        Copy
      </button>
      <div>
        {isRevealed ? token : '•'.repeat(token.length)}
      </div>
    </div>
  );
};

export { RevealableToken };

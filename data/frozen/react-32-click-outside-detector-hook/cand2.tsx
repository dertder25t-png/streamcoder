import React, { useEffect } from 'react';

const useClickOutside = (
  ref: React.RefObject<HTMLElement | null>,
  handler: () => void,
): void => {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent): void => {
      const target = event.target as HTMLElement | null;
      if (ref.current && !ref.current.contains(target)) {
        handler();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [ref, handler]);
};

export { useClickOutside };

import { useState, useEffect, useRef } from 'react';

const useLocalStorageState = <T>(key: string, initialValue: T): [T, (val: T | ((prev: T) => T)) => void] => {
  const [state, setState] = useState(() => {
    try {
      const value = window.localStorage.getItem(key);
      return value ? JSON.parse(value) : initialValue;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return initialValue;
    }
  });

  const storedValueRef = useRef(state);

  useEffect(() => {
    storedValueRef.current = state;
  }, [state]);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key) {
        try {
          const newValue = event.newValue ? JSON.parse(event.newValue) : initialValue;
          if (newValue !== storedValueRef.current) {
            setState(newValue);
          }
        } catch (error) {
          console.error('Error parsing localStorage value:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, initialValue]);

  const setValue = (value: T | ((prev: T) => T)) => {
    try {
      const valueToStore = typeof value === 'function' ? value(storedValueRef.current) : value;
      setState(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  };

  return [state, setValue];
};

export { useLocalStorageState };

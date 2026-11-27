import { useState, useEffect } from 'react';

export function useLocalStorageState<T>(
  key: string,
  initialValue: T
): [T, (val: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    const storedValue = localStorage.getItem(key);
    if (storedValue) {
      return JSON.parse(storedValue);
    }
    return initialValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key) {
        setValue(JSON.parse(event.newValue!));
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key]);

  const setValueWithUpdater = (val: T | ((prev: T) => T)) => {
    setValue(prev => {
      const nextValue = typeof val === 'function' ? (val as (prev: T) => T)(prev) : val;
      localStorage.setItem(key, JSON.stringify(nextValue));
      return nextValue;
    });
  };

  return [value, setValueWithUpdater];
}

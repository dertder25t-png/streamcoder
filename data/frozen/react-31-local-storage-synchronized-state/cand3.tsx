import { useState, useEffect } from 'react';

export function useLocalStorageState<T>(key: string, initialValue: T): [T, (val: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    const storedValue = localStorage.getItem(key);
    return storedValue ? (JSON.parse(storedValue) as T) : initialValue;
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
    setValue((prev) => (typeof val === 'function' ? (val as (prev: T) => T)(prev) : val));
  };

  return [value, setValueWithUpdater];
}

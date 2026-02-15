import { useEffect, useState, useCallback } from "react";

export function useLocalStorage<T>(key: string, initialValue: T | (() => T)) {
  const resolveInitialValue = useCallback((): T => {
    return initialValue instanceof Function ? initialValue() : initialValue;
  }, [initialValue]);

  const readValue = useCallback((): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : resolveInitialValue();
    } catch (error) {
      console.error(`Erro ao ler localStorage[${key}]:`, error);
      return resolveInitialValue();
    }
  }, [key, resolveInitialValue]);

  const [storedValue, setStoredValue] = useState<T>(() => readValue());

  // Keep value in sync when the key changes.
  useEffect(() => {
    setStoredValue(readValue());
  }, [readValue]);

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    setStoredValue((prev) => {
      try {
        const valueToStore = value instanceof Function ? value(prev) : value;
        localStorage.setItem(key, JSON.stringify(valueToStore));
        return valueToStore;
      } catch (error) {
        console.error(`Erro ao salvar localStorage[${key}]:`, error);
        return prev;
      }
    });
  }, [key]);

  const removeValue = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setStoredValue(resolveInitialValue());
    } catch (error) {
      console.error(`Erro ao remover localStorage[${key}]:`, error);
    }
  }, [key, resolveInitialValue]);

  return [storedValue, setValue, removeValue] as const;
}

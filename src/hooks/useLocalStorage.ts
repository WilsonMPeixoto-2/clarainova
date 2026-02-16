import { useState, useCallback, useEffect } from "react";

type InitialValue<T> = T | (() => T);

function resolveInitialValue<T>(initialValue: InitialValue<T>): T {
  return initialValue instanceof Function ? initialValue() : initialValue;
}

export function useLocalStorage<T>(key: string, initialValue: InitialValue<T>) {
  const readValue = useCallback((): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : resolveInitialValue(initialValue);
    } catch (error) {
      console.error(`Erro ao ler localStorage[${key}]:`, error);
      return resolveInitialValue(initialValue);
    }
  }, [key, initialValue]);

  const [storedValue, setStoredValue] = useState<T>(() => readValue());

  // Keep state in sync if the key changes.
  useEffect(() => {
    setStoredValue(readValue());
  }, [readValue]);

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      setStoredValue((prevValue) => {
        const valueToStore = value instanceof Function ? value(prevValue) : value;
        localStorage.setItem(key, JSON.stringify(valueToStore));
        return valueToStore;
      });
    } catch (error) {
      console.error(`Erro ao salvar localStorage[${key}]:`, error);
    }
  }, [key]);

  const removeValue = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setStoredValue(resolveInitialValue(initialValue));
    } catch (error) {
      console.error(`Erro ao remover localStorage[${key}]:`, error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue] as const;
}

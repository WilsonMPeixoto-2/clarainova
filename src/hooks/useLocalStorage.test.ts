import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLocalStorage } from "./useLocalStorage";

describe("useLocalStorage", () => {
  let storage: { [key: string]: string };

  beforeEach(() => {
    storage = {};
    
    vi.spyOn(Storage.prototype, "getItem").mockImplementation((key) => {
      return storage[key] || null;
    });
    
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => {
      storage[key] = value;
    });
    
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation((key) => {
      delete storage[key];
    });
  });

  it("returns initial value when localStorage is empty", () => {
    const { result } = renderHook(() => 
      useLocalStorage("test-key", "default-value")
    );

    expect(result.current[0]).toBe("default-value");
  });

  it("returns stored value when localStorage has data", () => {
    storage["test-key"] = JSON.stringify("stored-value");

    const { result } = renderHook(() => 
      useLocalStorage("test-key", "default-value")
    );

    expect(result.current[0]).toBe("stored-value");
  });

  it("updates localStorage when value changes", () => {
    const { result } = renderHook(() => 
      useLocalStorage("test-key", "initial")
    );

    act(() => {
      result.current[1]("new-value");
    });

    expect(storage["test-key"]).toBe(JSON.stringify("new-value"));
    expect(result.current[0]).toBe("new-value");
  });

  it("handles objects correctly", () => {
    const initialValue = { name: "test", count: 0 };
    const { result } = renderHook(() => 
      useLocalStorage("test-key", initialValue)
    );

    expect(result.current[0]).toEqual(initialValue);

    act(() => {
      result.current[1]({ name: "updated", count: 1 });
    });

    expect(result.current[0]).toEqual({ name: "updated", count: 1 });
    expect(JSON.parse(storage["test-key"])).toEqual({ name: "updated", count: 1 });
  });

  it("handles arrays correctly", () => {
    const initialValue = [1, 2, 3];
    const { result } = renderHook(() => 
      useLocalStorage("test-key", initialValue)
    );

    expect(result.current[0]).toEqual(initialValue);

    act(() => {
      result.current[1]([4, 5, 6]);
    });

    expect(result.current[0]).toEqual([4, 5, 6]);
  });

  it("handles null values", () => {
    const { result } = renderHook(() => 
      useLocalStorage<string | null>("test-key", null)
    );

    expect(result.current[0]).toBe(null);

    act(() => {
      result.current[1]("value");
    });

    expect(result.current[0]).toBe("value");

    act(() => {
      result.current[1](null);
    });

    expect(result.current[0]).toBe(null);
  });

  it("handles boolean values", () => {
    const { result } = renderHook(() => 
      useLocalStorage("test-key", false)
    );

    expect(result.current[0]).toBe(false);

    act(() => {
      result.current[1](true);
    });

    expect(result.current[0]).toBe(true);
    expect(storage["test-key"]).toBe("true");
  });

  it("handles number values", () => {
    const { result } = renderHook(() => 
      useLocalStorage("test-key", 0)
    );

    expect(result.current[0]).toBe(0);

    act(() => {
      result.current[1](42);
    });

    expect(result.current[0]).toBe(42);
    expect(storage["test-key"]).toBe("42");
  });

  it("handles corrupted localStorage data gracefully", () => {
    storage["test-key"] = "invalid-json{";

    const { result } = renderHook(() => 
      useLocalStorage("test-key", "default")
    );

    // Should fall back to default value
    expect(result.current[0]).toBe("default");
  });

  it("updates when key changes", () => {
    storage["key-1"] = JSON.stringify("value-1");
    storage["key-2"] = JSON.stringify("value-2");

    const { result, rerender } = renderHook(
      ({ key }) => useLocalStorage(key, "default"),
      { initialProps: { key: "key-1" } }
    );

    expect(result.current[0]).toBe("value-1");

    rerender({ key: "key-2" });

    expect(result.current[0]).toBe("value-2");
  });

  it("accepts function as initial value", () => {
    const { result } = renderHook(() => 
      useLocalStorage("test-key", () => "computed-value")
    );

    expect(result.current[0]).toBe("computed-value");
  });

  it("accepts function updater", () => {
    const { result } = renderHook(() => 
      useLocalStorage("test-key", 10)
    );

    act(() => {
      result.current[1]((prev) => prev + 5);
    });

    expect(result.current[0]).toBe(15);
  });
});

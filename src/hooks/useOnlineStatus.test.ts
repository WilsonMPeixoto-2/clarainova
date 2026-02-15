import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOnlineStatus } from "./useOnlineStatus";

describe("useOnlineStatus", () => {
  let originalNavigator: boolean;
  let listeners: { [key: string]: EventListener[] };

  beforeEach(() => {
    originalNavigator = window.navigator.onLine;
    listeners = {
      online: [],
      offline: [],
    };

    // Mock addEventListener
    vi.spyOn(window, "addEventListener").mockImplementation((event, handler) => {
      if (event === "online" || event === "offline") {
        listeners[event].push(handler as EventListener);
      }
    });

    // Mock removeEventListener
    vi.spyOn(window, "removeEventListener").mockImplementation((event, handler) => {
      if (event === "online" || event === "offline") {
        const index = listeners[event].indexOf(handler as EventListener);
        if (index > -1) {
          listeners[event].splice(index, 1);
        }
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      value: originalNavigator,
    });
  });

  it("returns initial online status", () => {
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      value: true,
    });

    const { result } = renderHook(() => useOnlineStatus());
    
    expect(result.current.isOnline).toBe(true);
  });

  it("returns false when navigator.onLine is false", () => {
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      value: false,
    });

    const { result } = renderHook(() => useOnlineStatus());
    
    expect(result.current.isOnline).toBe(false);
  });

  it("updates status when going offline", () => {
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      value: true,
    });

    const { result } = renderHook(() => useOnlineStatus());
    
    expect(result.current.isOnline).toBe(true);

    // Simulate going offline
    act(() => {
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: false,
      });
      listeners.offline.forEach(handler => handler(new Event("offline")));
    });

    expect(result.current.isOnline).toBe(false);
  });

  it("updates status when going online", () => {
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      value: false,
    });

    const { result } = renderHook(() => useOnlineStatus());
    
    expect(result.current.isOnline).toBe(false);

    // Simulate going online
    act(() => {
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: true,
      });
      listeners.online.forEach(handler => handler(new Event("online")));
    });

    expect(result.current.isOnline).toBe(true);
  });

  it("calls onOffline callback when going offline", () => {
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      value: true,
    });

    const onOffline = vi.fn();
    renderHook(() => useOnlineStatus({ onOffline }));

    // Simulate going offline
    act(() => {
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: false,
      });
      listeners.offline.forEach(handler => handler(new Event("offline")));
    });

    expect(onOffline).toHaveBeenCalledTimes(1);
  });

  it("calls onOnline callback when going online", () => {
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      value: false,
    });

    const onOnline = vi.fn();
    renderHook(() => useOnlineStatus({ onOnline }));

    // Simulate going online
    act(() => {
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: true,
      });
      listeners.online.forEach(handler => handler(new Event("online")));
    });

    expect(onOnline).toHaveBeenCalledTimes(1);
  });

  it("cleans up event listeners on unmount", () => {
    const { unmount } = renderHook(() => useOnlineStatus());

    expect(listeners.online.length).toBeGreaterThan(0);
    expect(listeners.offline.length).toBeGreaterThan(0);

    unmount();

    expect(listeners.online.length).toBe(0);
    expect(listeners.offline.length).toBe(0);
  });

  it("does not call callbacks on initial render", () => {
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      value: true,
    });

    const onOnline = vi.fn();
    const onOffline = vi.fn();

    renderHook(() => useOnlineStatus({ onOnline, onOffline }));

    expect(onOnline).not.toHaveBeenCalled();
    expect(onOffline).not.toHaveBeenCalled();
  });
});

import "@testing-library/jest-dom";
import { vi } from "vitest";

// Most unit tests don't require real Supabase connectivity.
// Mock the client globally to avoid failing on missing VITE_SUPABASE_* env vars.
vi.mock("@/integrations/supabase/client", () => {
  const chain: any = {};
  chain.insert = vi.fn(async () => ({ data: null, error: null }));
  chain.update = vi.fn(async () => ({ data: null, error: null }));
  chain.upsert = vi.fn(async () => ({ data: null, error: null }));
  chain.delete = vi.fn(async () => ({ data: null, error: null }));
  chain.select = vi.fn(() => chain);
  chain.single = vi.fn(async () => ({ data: null, error: null }));
  chain.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  chain.eq = vi.fn(() => chain);
  chain.neq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.range = vi.fn(() => chain);

  const from = vi.fn(() => chain);

  const rpc = vi.fn(async () => ({ data: null, error: null }));
  const functions = {
    invoke: vi.fn(async () => ({ data: null, error: null })),
  };

  const storageBucket = {
    remove: vi.fn(async () => ({ data: null, error: null })),
    upload: vi.fn(async () => ({ data: null, error: null })),
    createSignedUrl: vi.fn(async () => ({ data: null, error: null })),
    getPublicUrl: vi.fn(() => ({ data: { publicUrl: "" } })),
  };
  const storage = {
    from: vi.fn(() => storageBucket),
  };

  const subscription = { unsubscribe: vi.fn() };
  const auth = {
    onAuthStateChange: vi.fn(() => ({ data: { subscription } })),
    getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    signInWithOAuth: vi.fn(async () => ({ data: null, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
  };

  const channel = vi.fn(() => ({
    on: vi.fn(() => ({ subscribe: vi.fn(() => ({})) })),
    subscribe: vi.fn(() => ({})),
  }));

  return {
    supabase: {
      from,
      rpc,
      functions,
      storage,
      auth,
      channel,
      removeChannel: vi.fn(),
    },
  };
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

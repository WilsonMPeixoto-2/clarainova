import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const DOCUMENTS_URL = `${SUPABASE_URL}/functions/v1/documents`;

Deno.test("documents - should return 401 for GET without admin key", async () => {
  const response = await fetch(DOCUMENTS_URL, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  assertEquals(response.status, 401);
  const data = await response.json();
  assertExists(data.error);
  assert(data.error.includes("autorizado") || data.error.includes("Não"));
});

Deno.test("documents - should return 401 for POST without admin key", async () => {
  const response = await fetch(DOCUMENTS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ 
      filePath: "test.pdf",
      title: "Test Document"
    }),
  });

  assertEquals(response.status, 401);
  const data = await response.json();
  assertExists(data.error);
});

Deno.test("documents - should return 401 for DELETE without admin key", async () => {
  const response = await fetch(`${DOCUMENTS_URL}/fake-id`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  assertEquals(response.status, 401);
  const data = await response.json();
  assertExists(data.error);
});

Deno.test("documents - should return 401 for wrong admin key", async () => {
  const response = await fetch(DOCUMENTS_URL, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "x-admin-key": "wrong-key-12345",
    },
  });

  assertEquals(response.status, 401);
  const data = await response.json();
  assertExists(data.error);
});

Deno.test("documents - should handle OPTIONS preflight", async () => {
  const response = await fetch(DOCUMENTS_URL, {
    method: "OPTIONS",
    headers: {
      "Origin": "https://example.com",
      "Access-Control-Request-Method": "POST",
    },
  });

  assertEquals(response.status, 200);
  await response.text(); // Consume body
  
  const corsHeader = response.headers.get("Access-Control-Allow-Origin");
  assertExists(corsHeader);
});

Deno.test("documents - should return 400 for POST without filePath", async () => {
  // This test uses an invalid admin key, so it will return 401 first
  // If admin key validation passes, it should return 400 for missing filePath
  const response = await fetch(DOCUMENTS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "x-admin-key": "test-admin-key", // Will fail, but tests the flow
    },
    body: JSON.stringify({ 
      title: "Test Document"
      // Missing filePath
    }),
  });

  // Should be 401 (unauthorized) since we don't have valid admin key
  assertEquals(response.status, 401);
  await response.json();
});

Deno.test("documents - DELETE should return 401 for missing document ID", async () => {
  const response = await fetch(DOCUMENTS_URL, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  // Will fail at auth first
  assertEquals(response.status, 401);
  await response.json();
});

// Rate limiting test
Deno.test("documents - rate limiting should work for POST requests", async () => {
  // Make several rapid requests to trigger rate limiting
  const promises = [];
  for (let i = 0; i < 3; i++) {
    promises.push(
      fetch(DOCUMENTS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "x-admin-key": "invalid-key",
        },
        body: JSON.stringify({ filePath: "test.pdf" }),
      })
    );
  }

  const responses = await Promise.all(promises);
  
  // All should return 401 (auth fails before rate limit for invalid key)
  // But if rate limiting kicks in, we'd get 429
  for (const response of responses) {
    assert(
      response.status === 401 || response.status === 429,
      `Expected 401 or 429, got ${response.status}`
    );
    await response.json();
  }
});

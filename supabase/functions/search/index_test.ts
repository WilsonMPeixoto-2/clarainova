import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const SEARCH_URL = `${SUPABASE_URL}/functions/v1/search`;

Deno.test("search - should return 400 for missing query", async () => {
  const response = await fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({}),
  });

  assertEquals(response.status, 400);
  const data = await response.json();
  assertExists(data.error);
  assert(data.error.includes("obrigatória") || data.error.includes("Query"));
});

Deno.test("search - should return 400 for query too long", async () => {
  const longQuery = "a".repeat(501);
  
  const response = await fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ query: longQuery }),
  });

  assertEquals(response.status, 400);
  const data = await response.json();
  assertExists(data.error);
  assert(data.error.includes("longa") || data.error.includes("500"));
});

Deno.test("search - should return results for valid query", async () => {
  const response = await fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ 
      query: "como criar processo SEI",
      limit: 5
    }),
  });

  assertEquals(response.status, 200);
  const data = await response.json();
  
  assertExists(data.query);
  assertEquals(data.query, "como criar processo SEI");
  assertExists(data.expanded_terms);
  assert(Array.isArray(data.expanded_terms));
  assertExists(data.results);
  assert(Array.isArray(data.results));
  assert(data.results.length <= 5);
});

Deno.test("search - should expand synonyms correctly", async () => {
  const response = await fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ 
      query: "tramitar processo",
      limit: 3
    }),
  });

  assertEquals(response.status, 200);
  const data = await response.json();
  
  // "tramitar" deve expandir para incluir "enviar"
  assert(Array.isArray(data.expanded_terms));
  const hasEnviarSynonym = data.expanded_terms.some((term: string) => 
    ["enviar", "encaminhar", "remeter", "despachar", "expedir"].includes(term.toLowerCase())
  );
  assert(hasEnviarSynonym, "Should expand 'tramitar' to include 'enviar' synonyms");
});

Deno.test("search - should respect limit parameter", async () => {
  const response = await fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ 
      query: "documento",
      limit: 3
    }),
  });

  assertEquals(response.status, 200);
  const data = await response.json();
  
  assert(data.results.length <= 3, "Results should respect limit parameter");
});

Deno.test("search - should include scores in results", async () => {
  const response = await fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ 
      query: "assinatura bloco",
      limit: 2
    }),
  });

  assertEquals(response.status, 200);
  const data = await response.json();
  
  if (data.results.length > 0) {
    const firstResult = data.results[0];
    assertExists(firstResult.scores, "Result should have scores object");
    assertExists(firstResult.scores.combined, "Result should have combined score");
  }
});

Deno.test("search - should handle OPTIONS preflight", async () => {
  const response = await fetch(SEARCH_URL, {
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

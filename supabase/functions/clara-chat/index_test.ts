import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const CHAT_URL = `${SUPABASE_URL}/functions/v1/clara-chat`;

Deno.test("clara-chat - should return 400 for missing message", async () => {
  const response = await fetch(CHAT_URL, {
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
});

Deno.test("clara-chat - should return 400 for message too long", async () => {
  const longMessage = "a".repeat(10001);
  
  const response = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ message: longMessage }),
  });

  assertEquals(response.status, 400);
  const data = await response.json();
  assertExists(data.error);
  assert(data.error.includes("longa") || data.error.includes("10000"));
});

Deno.test("clara-chat - should return 400 for too many history messages", async () => {
  const tooManyMessages = Array(51).fill({ role: "user", content: "test" });
  
  const response = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ 
      message: "test",
      history: tooManyMessages
    }),
  });

  assertEquals(response.status, 400);
  const data = await response.json();
  assertExists(data.error);
  assert(data.error.includes("histórico") || data.error.includes("50"));
});

Deno.test("clara-chat - should handle OPTIONS preflight", async () => {
  const response = await fetch(CHAT_URL, {
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

Deno.test("clara-chat - should stream response for valid query", async () => {
  const response = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ 
      message: "O que é o SEI?",
      mode: "fast"
    }),
  });

  // Should return 200 with streaming
  assertEquals(response.status, 200);
  
  const contentType = response.headers.get("Content-Type");
  assert(
    contentType?.includes("text/event-stream") || contentType?.includes("text/plain"),
    "Should return streaming content type"
  );

  // Consume the entire body to avoid leaks
  await response.text();
});

Deno.test("clara-chat - should reject off-topic questions", async () => {
  const response = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ 
      message: "Qual é a receita de bolo de chocolate?",
      mode: "fast"
    }),
  });

  assertEquals(response.status, 200);
  
  // Read the stream and look for refusal indicators
  const text = await response.text();
  
  // Should contain some form of refusal or scope limitation
  const refusalPatterns = [
    "foco exclusivo",
    "área de atuação",
    "escopo",
    "rotinas administrativas",
    "SEI",
    "legislação"
  ];
  
  const containsRefusal = refusalPatterns.some(pattern => 
    text.toLowerCase().includes(pattern.toLowerCase())
  );
  
  assert(containsRefusal, "Should refuse off-topic questions politely");
});

Deno.test("clara-chat - should accept different response modes", async () => {
  // Test fast mode
  const fastResponse = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ 
      message: "Como criar um processo?",
      mode: "fast"
    }),
  });

  assertEquals(fastResponse.status, 200);
  await fastResponse.text(); // Consume body

  // Test deep mode
  const deepResponse = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ 
      message: "Como criar um processo?",
      mode: "deep"
    }),
  });

  assertEquals(deepResponse.status, 200);
  await deepResponse.text(); // Consume body
});

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req: Request) => {
  const apiKey = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY");

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "GOOGLE_GENERATIVE_AI_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // Small test call to Gemini generate endpoint
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: "Responda apenas 'OK' se a API Gemini estiver funcionando." }],
            },
          ],
          generationConfig: {
            temperature: 0.0,
            maxOutputTokens: 16,
          },
        }),
      }
    );

    const bodyText = await response.text();
    const status = response.status;

    if (!response.ok) {
      console.error(`[test-gemini-key] Gemini returned status ${status}: ${bodyText}`);
      return new Response(
        JSON.stringify({ error: "Gemini API request failed", status, body: bodyText }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const json = JSON.parse(bodyText);
    const answer = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;

    return new Response(
      JSON.stringify({ success: true, status, answer, fullResponse: json }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[test-gemini-key] Error calling Gemini:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
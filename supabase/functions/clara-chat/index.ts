// --- trecho: montar e retornar payload da resposta (SUCESSO)

const totalTime = Date.now() - startTime;

const providerSafe =
  typeof provider === "string" && provider.trim() ? provider : "unknown";

const chunksSafe = Array.isArray(chunks) ? chunks : [];

const responsePayload = {
  answer,
  provider: providerSafe,
  sources: chunksSafe.map((c: any) => ({
    title: String(c?.document_title ?? c?.title ?? "Documento"),
    similarity: typeof c?.similarity === "number" ? c.similarity : null,
  })),
  metrics: {
    total_time_ms: totalTime,
    llm_time_ms: typeof llmTimeMs === "number" ? llmTimeMs : null,
    chunks_found: chunksSafe.length,
  },
};

console.log(
  `[clara-chat ${VERSION}] ✅ response payload: provider=${providerSafe} total_time_ms=${totalTime} chunks=${chunksSafe.length}`,
);

return new Response(JSON.stringify(responsePayload), {
  status: 200,
  headers: {
    ...(typeof corsHeaders === "object" ? corsHeaders : {}),
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  },
};

// The catch block remains unchanged.
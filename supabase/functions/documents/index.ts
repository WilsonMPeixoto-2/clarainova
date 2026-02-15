import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-key",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`;

const DEFAULT_CHUNK_MAX_CHARS = 1500;
const DEFAULT_CHUNK_OVERLAP_CHARS = 200;
const EMBED_BATCH_SIZE = 5; // processed per /process-job call (keeps runtime bounded)

const encoder = new TextEncoder();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function subPath(req: Request): string {
  const url = new URL(req.url);
  const idx = url.pathname.lastIndexOf("/documents");
  if (idx < 0) return "";
  const rest = url.pathname.slice(idx + "/documents".length);
  return rest.replace(/^\/+/, ""); // "" | "ingest-text" | "process-job" | etc
}

function requireAdmin(req: Request): { ok: true } | { ok: false; response: Response } {
  const expectedKey = (Deno.env.get("ADMIN_KEY") || "").trim();
  const adminKey = (req.headers.get("x-admin-key") || "").trim();

  if (!expectedKey) {
    return { ok: false, response: json({ error: "Server misconfigured (ADMIN_KEY missing)" }, 500) };
  }
  if (!adminKey || adminKey !== expectedKey) {
    return { ok: false, response: json({ error: "Acesso não autorizado" }, 401) };
  }
  return { ok: true };
}

function getSupabaseAdmin() {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const supabaseServiceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("CONFIG:SUPABASE_ENV_MISSING");
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

function getGeminiApiKey(): string {
  return (Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") || Deno.env.get("GEMINI_API_KEY") || "").trim();
}

async function recordProcessingMetric(
  supabase: any,
  params: {
    documentId?: string | null;
    step: string;
    durationMs: number;
    success: boolean;
    errorMessage?: string | null;
    metadata?: Record<string, unknown> | null;
  },
): Promise<void> {
  try {
    await supabase.from("processing_metrics").insert({
      document_id: params.documentId ?? null,
      step: params.step,
      duration_ms: Math.max(0, Math.round(params.durationMs)),
      success: params.success,
      error_message: params.errorMessage ?? null,
      metadata: params.metadata ?? null,
    });
  } catch {
    // best-effort
  }
}

function normalizeText(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunkText(inputRaw: string, maxChars = DEFAULT_CHUNK_MAX_CHARS, overlap = DEFAULT_CHUNK_OVERLAP_CHARS): string[] {
  const input = normalizeText(inputRaw);
  if (!input) return [];

  const chunks: string[] = [];
  let start = 0;
  const len = input.length;

  while (start < len) {
    let end = Math.min(start + maxChars, len);

    // Try to break on a "natural" boundary near the end.
    const windowStart = Math.max(start + Math.floor(maxChars * 0.6), start);
    const slice = input.slice(windowStart, end);
    const boundary = Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf("\n"), slice.lastIndexOf(". "));
    if (boundary > -1) {
      end = windowStart + boundary + (slice[boundary] === "." ? 2 : 0);
    }

    const chunk = input.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    if (end >= len) break;
    start = Math.max(0, end - overlap);
    // Ensure progress even on pathological inputs.
    if (chunks.length > 1 && start <= (end - maxChars)) start = end;
  }

  return chunks;
}

async function sha256Hex(text: string): Promise<string> {
  const data = encoder.encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch(EMBEDDING_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      outputDimensionality: 768,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    const err = new Error(`Embedding failed: ${response.status} - ${errText}`);
    (err as any).status = response.status;
    throw err;
  }

  const data = await response.json().catch(() => ({} as any));
  return data.embedding?.values || [];
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function listDocuments(): Promise<Response> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("documents")
    .select(
      "id,title,category,file_path,created_at,updated_at,chunk_count,status,error_reason,tags,version_label,effective_date,supersedes_document_id",
    )
    .order("updated_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("[documents] list failed", error);
    return json({ error: "Falha ao listar documentos" }, 500);
  }

  return json({ documents: data || [] }, 200);
}

async function deleteDocument(req: Request): Promise<Response> {
  const payload = await req.json().catch(() => ({} as Record<string, unknown>));
  const id = String(payload.id ?? "").trim();
  if (!id || !isUuid(id)) return json({ error: "Invalid id" }, 400);

  const supabase = getSupabaseAdmin();

  // Fetch file path for optional storage cleanup.
  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id,file_path")
    .eq("id", id)
    .maybeSingle();
  if (docErr) {
    console.error("[documents] delete lookup failed", docErr);
    return json({ error: "Falha ao localizar documento" }, 500);
  }
  if (!doc) return json({ error: "Documento não encontrado" }, 404);

  // Delete chunks first.
  const { error: delChunksErr } = await supabase.from("document_chunks").delete().eq("document_id", id);
  if (delChunksErr) {
    console.error("[documents] delete chunks failed", delChunksErr);
    return json({ error: "Falha ao remover chunks" }, 500);
  }

  // Delete job records (best-effort).
  try {
    await supabase.from("document_jobs").delete().eq("document_id", id);
  } catch {
    // ignore
  }

  const { error: delDocErr } = await supabase.from("documents").delete().eq("id", id);
  if (delDocErr) {
    console.error("[documents] delete doc failed", delDocErr);
    return json({ error: "Falha ao remover documento" }, 500);
  }

  // Best-effort storage cleanup.
  const bucket = (Deno.env.get("KNOWLEDGE_BUCKET") || "knowledge-base").trim();
  if (doc.file_path) {
    try {
      await supabase.storage.from(bucket).remove([doc.file_path]);
    } catch {
      // ignore
    }
  }

  return json({ ok: true }, 200);
}

async function ingestText(payload: Record<string, unknown>): Promise<Response> {
  const startedAt = Date.now();
  const title = String(payload.title ?? "").trim().slice(0, 200);
  const category = String(payload.category ?? "manual").trim().slice(0, 80) || "manual";
  const fullTextRaw = String(payload.fullText ?? payload.full_text ?? "").trim();
  const filePath = payload.filePath == null ? null : String(payload.filePath).trim().slice(0, 512);
  const metadata = (payload.metadata && typeof payload.metadata === "object") ? (payload.metadata as Record<string, unknown>) : null;

  if (!title) return json({ error: "Título obrigatório" }, 400);
  if (!fullTextRaw) return json({ error: "Texto vazio" }, 400);

  const fullText = normalizeText(fullTextRaw);
  const chunks = chunkText(fullText);
  if (chunks.length === 0) return json({ error: "Texto vazio" }, 400);

  const supabase = getSupabaseAdmin();
  const contentHash = await sha256Hex(fullText).catch(() => null);

  const sourceFileName = metadata && typeof metadata.originalFilename === "string"
    ? String(metadata.originalFilename).slice(0, 256)
    : null;

  const { data: doc, error: insDocErr } = await supabase
    .from("documents")
    .insert({
      title,
      category,
      file_path: filePath,
      content_text: fullText,
      status: "processing",
      error_reason: null,
      chunk_count: chunks.length,
      content_hash: contentHash,
      source_file_name: sourceFileName,
      extraction_metadata: metadata ?? {},
    })
    .select("id")
    .single();

  if (insDocErr || !doc?.id) {
    console.error("[documents] ingest-text insert doc failed", insDocErr);
    await recordProcessingMetric(supabase, {
      documentId: null,
      step: "db_insert",
      durationMs: Date.now() - startedAt,
      success: false,
      errorMessage: insDocErr?.message || "Falha ao criar documento",
      metadata: { endpoint: "ingest-text" },
    });
    return json({ error: "Falha ao criar documento" }, 500);
  }

  const documentId = String(doc.id);

  const baseChunkMetadata = {
    title,
    category,
    file_path: filePath,
    source_file_name: sourceFileName,
  };

  // Insert chunks in batches to avoid request limits.
  const BATCH = 200;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH);
    const rows = slice.map((content, j) => ({
      document_id: documentId,
      content,
      chunk_index: i + j,
      embedding: null,
      metadata: { ...baseChunkMetadata, chunk_index: i + j },
    }));

    const { error } = await supabase.from("document_chunks").insert(rows);
    if (error) {
      console.error("[documents] ingest-text insert chunks failed", error);
      await supabase
        .from("documents")
        .update({ status: "failed", error_reason: `Falha ao inserir chunks: ${error.message}` })
        .eq("id", documentId);
      await recordProcessingMetric(supabase, {
        documentId,
        step: "db_insert",
        durationMs: Date.now() - startedAt,
        success: false,
        errorMessage: error.message,
        metadata: { endpoint: "ingest-text", inserted_chunks: i },
      });
      return json({ error: "Falha ao inserir chunks" }, 500);
    }
  }

  await recordProcessingMetric(supabase, {
    documentId,
    step: "db_insert",
    durationMs: Date.now() - startedAt,
    success: true,
    metadata: { endpoint: "ingest-text", chunks: chunks.length },
  });

  return json({ ok: true, documentId, chunks: chunks.length }, 200);
}

async function ingestStart(payload: Record<string, unknown>): Promise<Response> {
  const title = String(payload.title ?? "").trim().slice(0, 200);
  const category = String(payload.category ?? "manual").trim().slice(0, 80) || "manual";
  const filePath = payload.filePath == null ? null : String(payload.filePath).trim().slice(0, 512);
  const metadata = (payload.metadata && typeof payload.metadata === "object") ? (payload.metadata as Record<string, unknown>) : null;

  if (!title) return json({ error: "Título obrigatório" }, 400);

  const supabase = getSupabaseAdmin();
  const sourceFileName = metadata && typeof metadata.originalFilename === "string"
    ? String(metadata.originalFilename).slice(0, 256)
    : null;

  const { data: doc, error } = await supabase
    .from("documents")
    .insert({
      title,
      category,
      file_path: filePath,
      status: "ingesting",
      error_reason: null,
      chunk_count: 0,
      source_file_name: sourceFileName,
      extraction_metadata: metadata ?? {},
    })
    .select("id")
    .single();

  if (error || !doc?.id) {
    console.error("[documents] ingest-start insert doc failed", error);
    return json({ error: "Falha ao iniciar ingestão" }, 500);
  }

  return json({ ok: true, documentId: doc.id }, 200);
}

async function ingestBatch(payload: Record<string, unknown>): Promise<Response> {
  const startedAt = Date.now();
  const documentId = String(payload.documentId ?? payload.document_id ?? "").trim();
  const batchTextRaw = String(payload.batchText ?? payload.batch_text ?? "").trim();
  const batchIndex = Number(payload.batchIndex ?? payload.batch_index ?? 0);
  const totalBatches = Number(payload.totalBatches ?? payload.total_batches ?? 0);

  if (!documentId || !isUuid(documentId)) return json({ error: "Invalid documentId" }, 400);
  if (!batchTextRaw) return json({ error: "batchText vazio" }, 400);
  if (!Number.isFinite(batchIndex) || batchIndex < 1) return json({ error: "Invalid batchIndex" }, 400);
  if (!Number.isFinite(totalBatches) || totalBatches < 1) return json({ error: "Invalid totalBatches" }, 400);

  const supabase = getSupabaseAdmin();

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id,title,category,file_path,source_file_name")
    .eq("id", documentId)
    .maybeSingle();
  if (docErr) {
    console.error("[documents] ingest-batch lookup failed", docErr);
    await recordProcessingMetric(supabase, {
      documentId,
      step: "db_insert",
      durationMs: Date.now() - startedAt,
      success: false,
      errorMessage: docErr.message,
      metadata: { endpoint: "ingest-batch", batch_index: batchIndex, total_batches: totalBatches },
    });
    return json({ error: "Falha ao localizar documento" }, 500);
  }
  if (!doc) return json({ error: "Documento não encontrado" }, 404);

  // Compute current max chunk index.
  const { data: lastChunk, error: lastErr } = await supabase
    .from("document_chunks")
    .select("chunk_index")
    .eq("document_id", documentId)
    .order("chunk_index", { ascending: false })
    .limit(1);
  if (lastErr) {
    console.error("[documents] ingest-batch max chunk lookup failed", lastErr);
    await recordProcessingMetric(supabase, {
      documentId,
      step: "db_insert",
      durationMs: Date.now() - startedAt,
      success: false,
      errorMessage: lastErr.message,
      metadata: { endpoint: "ingest-batch", batch_index: batchIndex, total_batches: totalBatches },
    });
    return json({ error: "Falha ao preparar chunks" }, 500);
  }
  const startIndex = Array.isArray(lastChunk) && lastChunk[0] && typeof lastChunk[0].chunk_index === "number"
    ? (lastChunk[0].chunk_index as number) + 1
    : 0;

  const chunkContents = chunkText(batchTextRaw);
  if (chunkContents.length === 0) return json({ error: "batchText vazio" }, 400);

  const baseChunkMetadata = {
    title: doc.title,
    category: doc.category,
    file_path: doc.file_path,
    source_file_name: doc.source_file_name,
    batch_index: batchIndex,
    total_batches: totalBatches,
  };

  const BATCH = 200;
  for (let i = 0; i < chunkContents.length; i += BATCH) {
    const slice = chunkContents.slice(i, i + BATCH);
    const rows = slice.map((content, j) => {
      const idx = startIndex + i + j;
      return {
        document_id: documentId,
        content,
        chunk_index: idx,
        embedding: null,
        metadata: { ...baseChunkMetadata, chunk_index: idx },
      };
    });

    const { error } = await supabase.from("document_chunks").insert(rows);
    if (error) {
      console.error("[documents] ingest-batch insert failed", error);
      await supabase
        .from("documents")
        .update({ status: "failed", error_reason: `Falha ao inserir batch: ${error.message}` })
        .eq("id", documentId);
      await recordProcessingMetric(supabase, {
        documentId,
        step: "db_insert",
        durationMs: Date.now() - startedAt,
        success: false,
        errorMessage: error.message,
        metadata: { endpoint: "ingest-batch", batch_index: batchIndex, total_batches: totalBatches },
      });
      return json({ error: "Falha ao inserir batch" }, 500);
    }
  }

  // Track progress on the document_jobs table (best-effort, optional for UI).
  try {
    await supabase.from("document_jobs").upsert(
      {
        document_id: documentId,
        status: "ingesting",
        last_batch_index: batchIndex,
        total_batches: totalBatches,
      },
      { onConflict: "document_id" },
    );
  } catch {
    // ignore
  }

  await recordProcessingMetric(supabase, {
    documentId,
    step: "db_insert",
    durationMs: Date.now() - startedAt,
    success: true,
    metadata: { endpoint: "ingest-batch", batch_index: batchIndex, total_batches: totalBatches, chunks: chunkContents.length },
  });

  return json({ ok: true }, 200);
}

async function ingestFinish(payload: Record<string, unknown>): Promise<Response> {
  const documentId = String(payload.documentId ?? payload.document_id ?? "").trim();
  if (!documentId || !isUuid(documentId)) return json({ error: "Invalid documentId" }, 400);

  const supabase = getSupabaseAdmin();

  const { count, error: countErr } = await supabase
    .from("document_chunks")
    .select("id", { count: "exact", head: true })
    .eq("document_id", documentId);
  if (countErr) {
    console.error("[documents] ingest-finish count failed", countErr);
    return json({ error: "Falha ao finalizar ingestão" }, 500);
  }

  const total = count || 0;
  if (total === 0) {
    await supabase.from("documents").update({ status: "failed", error_reason: "Nenhum chunk gerado" }).eq("id", documentId);
    return json({ error: "Nenhum chunk gerado" }, 400);
  }

  const { error } = await supabase
    .from("documents")
    .update({ status: "processing", error_reason: null, chunk_count: total })
    .eq("id", documentId);

  if (error) {
    console.error("[documents] ingest-finish update doc failed", error);
    return json({ error: "Falha ao finalizar ingestão" }, 500);
  }

  try {
    await supabase.from("document_jobs").upsert(
      {
        document_id: documentId,
        status: "processing",
        last_batch_index: null,
        total_batches: null,
      },
      { onConflict: "document_id" },
    );
  } catch {
    // ignore
  }

  return json({ ok: true, documentId, chunks: total }, 200);
}

async function processDocument(payload: Record<string, unknown>): Promise<Response> {
  const documentId = String(payload.document_id ?? payload.documentId ?? "").trim();
  if (!documentId || !isUuid(documentId)) return json({ error: "Invalid document_id" }, 400);

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("documents")
    .update({ status: "processing", error_reason: null })
    .eq("id", documentId);

  if (error) {
    console.error("[documents] process update failed", error);
    return json({ error: "Falha ao iniciar processamento" }, 500);
  }

  return json({ ok: true, status: "processing", documentId }, 200);
}

async function processJob(): Promise<Response> {
  const startedAt = Date.now();
  const apiKey = getGeminiApiKey();
  if (!apiKey) return json({ error: "CONFIG:GEMINI_API_KEY_MISSING" }, 500);

  const supabase = getSupabaseAdmin();

  // Pick one document to work on (oldest first).
  const { data: docs, error: docsErr } = await supabase
    .from("documents")
    .select("id,title,chunk_count,status")
    .in("status", ["processing", "chunks_ok_embed_pending"])
    .order("updated_at", { ascending: true })
    .limit(1);
  if (docsErr) {
    console.error("[documents] process-job pick doc failed", docsErr);
    await recordProcessingMetric(supabase, {
      documentId: null,
      step: "embed",
      durationMs: Date.now() - startedAt,
      success: false,
      errorMessage: docsErr.message,
      metadata: { endpoint: "process-job" },
    });
    return json({ error: "Falha ao iniciar job" }, 500);
  }
  const doc = Array.isArray(docs) ? docs[0] : null;
  if (!doc) return json({ status: "idle" }, 200);

  const documentId = String(doc.id);

  // Fetch next chunks that still need embeddings.
  const { data: chunks, error: chunksErr } = await supabase
    .from("document_chunks")
    .select("id,content,chunk_index")
    .eq("document_id", documentId)
    .is("embedding", null)
    .order("chunk_index", { ascending: true })
    .limit(EMBED_BATCH_SIZE);

  if (chunksErr) {
    console.error("[documents] process-job fetch chunks failed", chunksErr);
    await supabase
      .from("documents")
      .update({ status: "failed", error_reason: `Falha ao buscar chunks: ${chunksErr.message}` })
      .eq("id", documentId);
    await recordProcessingMetric(supabase, {
      documentId,
      step: "embed",
      durationMs: Date.now() - startedAt,
      success: false,
      errorMessage: chunksErr.message,
      metadata: { endpoint: "process-job" },
    });
    return json({ error: "Falha ao buscar chunks" }, 500);
  }

  const todo = Array.isArray(chunks) ? chunks : [];
  if (todo.length === 0) {
    await supabase
      .from("documents")
      .update({ status: "ready", error_reason: null, processed_at: new Date().toISOString() })
      .eq("id", documentId);
    await recordProcessingMetric(supabase, {
      documentId,
      step: "embed",
      durationMs: Date.now() - startedAt,
      success: true,
      metadata: { endpoint: "process-job", embedded_now: 0, completed: true },
    });
    return json({ status: "completed", documentId }, 200);
  }

  let embeddedNow = 0;
  for (const chunk of todo) {
    try {
      const embedding = await generateEmbedding(String(chunk.content || ""), apiKey);
      if (embedding.length !== 768) {
        throw new Error(`Dimensão incorreta: ${embedding.length} (esperado 768)`);
      }

      const { error: updErr } = await supabase
        .from("document_chunks")
        .update({ embedding: JSON.stringify(embedding) })
        .eq("id", chunk.id);
      if (updErr) throw new Error(updErr.message);

      embeddedNow++;
      // Small delay to reduce burstiness.
      await new Promise((r) => setTimeout(r, 120));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = (err as any)?.status;

      console.error("[documents] embedding failed", { documentId, chunkId: chunk.id, msg, status });

      if (status === 429) {
        await supabase
          .from("documents")
          .update({
            status: "chunks_ok_embed_pending",
            error_reason: "Rate limit na API de embeddings. Tente novamente em alguns minutos.",
          })
          .eq("id", documentId);
        await recordProcessingMetric(supabase, {
          documentId,
          step: "embed",
          durationMs: Date.now() - startedAt,
          success: false,
          errorMessage: "Rate limit na API de embeddings",
          metadata: { endpoint: "process-job", embedded_now: embeddedNow },
        });
        return json({ status: "processing", documentId, rate_limited: true }, 200);
      }

      await supabase
        .from("documents")
        .update({ status: "failed", error_reason: `Embeddings falharam: ${msg}` })
        .eq("id", documentId);
      await recordProcessingMetric(supabase, {
        documentId,
        step: "embed",
        durationMs: Date.now() - startedAt,
        success: false,
        errorMessage: msg,
        metadata: { endpoint: "process-job", embedded_now: embeddedNow },
      });
      return json({ status: "processing", documentId, error: msg }, 200);
    }
  }

  // Update job row (best-effort).
  try {
    const { count } = await supabase
      .from("document_chunks")
      .select("id", { count: "exact", head: true })
      .eq("document_id", documentId)
      .is("embedding", null);

    const remaining = count || 0;
    await supabase.from("document_jobs").upsert(
      { document_id: documentId, status: "processing", next_page: 1, total_pages: 1, last_batch_index: null, total_batches: null },
      { onConflict: "document_id" },
    );

    if (remaining === 0) {
      await supabase
        .from("documents")
        .update({ status: "ready", error_reason: null, processed_at: new Date().toISOString() })
        .eq("id", documentId);
      await recordProcessingMetric(supabase, {
        documentId,
        step: "embed",
        durationMs: Date.now() - startedAt,
        success: true,
        metadata: { endpoint: "process-job", embedded_now: embeddedNow, remaining: 0 },
      });
      return json({ status: "completed", documentId }, 200);
    }
  } catch {
    // ignore
  }

  await recordProcessingMetric(supabase, {
    documentId,
    step: "embed",
    durationMs: Date.now() - startedAt,
    success: true,
    metadata: { endpoint: "process-job", embedded_now: embeddedNow },
  });

  return json({ status: "processing", documentId, embeddedNow }, 200);
}

async function ocrBatch(req: Request): Promise<Response> {
  const startedAt = Date.now();
  const apiKey = getGeminiApiKey();
  if (!apiKey) return json({ error: "CONFIG:GEMINI_API_KEY_MISSING" }, 500);

  let supabase: any | null = null;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    // metrics are best-effort
  }

  const payload = await req.json().catch(() => ({} as Record<string, unknown>));
  const pageImages = Array.isArray(payload.pageImages) ? (payload.pageImages as any[]) : [];

  if (pageImages.length === 0) return json({ error: "pageImages vazio" }, 400);

  const model = (Deno.env.get("GEMINI_OCR_MODEL") || "gemini-1.5-flash").trim();
  const prompt =
    "Extraia TODO o texto legível (português) das imagens a seguir. " +
    "Retorne APENAS texto puro, mantendo a ordem das páginas, sem Markdown e sem comentários.";

  const parts: any[] = [{ text: prompt }];

  for (const img of pageImages) {
    const dataUrl = String(img?.dataUrl ?? "").trim();
    if (!dataUrl.startsWith("data:")) continue;
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) continue;
    const mimeType = match[1];
    const data = match[2];
    parts.push({ inlineData: { mimeType, data } });
  }

  if (parts.length === 1) return json({ error: "Nenhuma imagem válida" }, 400);

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
      }),
    },
  );

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    if (supabase) {
      await recordProcessingMetric(supabase, {
        documentId: null,
        step: "ocr",
        durationMs: Date.now() - startedAt,
        success: false,
        errorMessage: `OCR_FAILED:${resp.status}`,
        metadata: { endpoint: "ocr-batch" },
      });
    }
    return json({ error: `OCR failed: ${resp.status} - ${text}` }, 500);
  }

  const data = await resp.json().catch(() => ({} as any));
  const extractedText =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: any) => (typeof p?.text === "string" ? p.text : ""))
      .join("")
      .trim() || "";

  if (!extractedText) {
    if (supabase) {
      await recordProcessingMetric(supabase, {
        documentId: null,
        step: "ocr",
        durationMs: Date.now() - startedAt,
        success: false,
        errorMessage: "OCR_EMPTY_TEXT",
        metadata: { endpoint: "ocr-batch" },
      });
    }
    return json({ error: "OCR retornou vazio" }, 502);
  }

  if (supabase) {
    await recordProcessingMetric(supabase, {
      documentId: null,
      step: "ocr",
      durationMs: Date.now() - startedAt,
      success: true,
      metadata: { endpoint: "ocr-batch", pages: pageImages.length },
    });
  }

  return json({ extractedText }, 200);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;

  const route = subPath(req);

  try {
    if (req.method === "GET" && route === "") {
      return await listDocuments();
    }

    if (req.method === "DELETE" && route === "") {
      return await deleteDocument(req);
    }

    if (req.method === "POST" && route === "ingest-text") {
      const payload = await req.json().catch(() => ({} as Record<string, unknown>));
      return await ingestText(payload);
    }

    if (req.method === "POST" && route === "ingest-start") {
      const payload = await req.json().catch(() => ({} as Record<string, unknown>));
      return await ingestStart(payload);
    }

    if (req.method === "POST" && route === "ingest-batch") {
      const payload = await req.json().catch(() => ({} as Record<string, unknown>));
      return await ingestBatch(payload);
    }

    if (req.method === "POST" && route === "ingest-finish") {
      const payload = await req.json().catch(() => ({} as Record<string, unknown>));
      return await ingestFinish(payload);
    }

    if (req.method === "POST" && route === "process") {
      const payload = await req.json().catch(() => ({} as Record<string, unknown>));
      return await processDocument(payload);
    }

    if (req.method === "POST" && route === "process-job") {
      return await processJob();
    }

    if (req.method === "POST" && route === "ocr-batch") {
      return await ocrBatch(req);
    }

    // Legacy path: POST /documents (DOCX backend extraction) is intentionally not implemented yet.
    if (req.method === "POST" && route === "") {
      return json(
        { error: "Endpoint legado não suportado. Use /documents/ingest-text (PDF/TXT) ou converta DOCX para PDF/TXT." },
        400,
      );
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[documents] fatal error", err);
    if (msg === "CONFIG:SUPABASE_ENV_MISSING") return json({ error: msg }, 500);
    return json({ error: "Erro interno" }, 500);
  }
});

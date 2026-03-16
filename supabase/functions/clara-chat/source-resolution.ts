export interface SearchChunkLike {
  id: string;
  document_id: string;
  content: string;
  metadata: Record<string, unknown> | null;
  chunk_index: number;
  similarity: number;
  combined_score?: number;
}

export interface DocumentProfile {
  id: string;
  title: string;
  category: string | null;
  version_label?: string | null;
  effective_date?: string | null;
  tags?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface RankedChunk extends SearchChunkLike {
  resolved_title: string;
  source_bias: number;
  final_score: number;
  score_reasons: string[];
}

export interface SourceAssessment {
  rankedChunks: RankedChunk[];
  ambiguityDetected: boolean;
  lowConfidence: boolean;
  needsInternalExpansion: boolean;
  comparedTitles: string[];
  preferredTitles: string[];
  averageScore: number;
}

function normalizeText(value: string | null | undefined): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function extractYears(value: string): number[] {
  const matches = value.match(/\b20\d{2}\b/g) || [];
  return matches.map((item) => Number(item)).filter((item) => Number.isFinite(item));
}

function safeDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sourceBias(profile: DocumentProfile | undefined): { score: number; reasons: string[] } {
  if (!profile) return { score: 0, reasons: [] };

  const reasons: string[] = [];
  let score = 0;
  const haystack = normalizeText(
    [profile.title, profile.category, profile.version_label, ...(profile.tags || [])].join(" "),
  );

  if (/sei[- ]?rio/.test(haystack)) {
    score += 4.5;
    reasons.push("sei_rio_priority");
  } else if (/\bsei\b/.test(haystack)) {
    score += 1.5;
    reasons.push("sei_context");
  }

  if (/federal/.test(haystack) && !/sei[- ]?rio/.test(haystack)) {
    score -= 1.25;
    reasons.push("federal_secondary");
  }

  if (/(manual|guia|faq|perguntas frequentes|instru[cç][aã]o)/.test(haystack)) {
    score += 1.2;
    reasons.push("document_authority");
  }

  if (/(oficial|prefeitura|secretaria|rio prefeitura|sme)/.test(haystack)) {
    score += 1.1;
    reasons.push("official_origin");
  }

  if (/(antig|legad|obsolet|desatual|deprecated)/.test(haystack)) {
    score -= 3;
    reasons.push("legacy_penalty");
  }

  if (/(vigente|atual|atualizado|versao atual)/.test(haystack)) {
    score += 1.4;
    reasons.push("current_marker");
  }

  const years = extractYears(haystack);
  const maxYear = years.length > 0 ? Math.max(...years) : null;
  if (maxYear && maxYear >= new Date().getFullYear() - 1) {
    score += 1.1;
    reasons.push("recent_year");
  } else if (maxYear && maxYear <= new Date().getFullYear() - 4) {
    score -= 0.8;
    reasons.push("old_year_penalty");
  }

  const effectiveDate =
    safeDate(profile.effective_date) || safeDate(profile.updated_at) || safeDate(profile.created_at);
  if (effectiveDate) {
    const ageDays = Math.max(
      0,
      Math.round((Date.now() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24)),
    );
    if (ageDays <= 730) {
      score += 1.2;
      reasons.push("recent_effective_date");
    } else if (ageDays >= 1460) {
      score -= 0.6;
      reasons.push("older_effective_date");
    }
  }

  return { score, reasons };
}

function retrievalScore(chunk: SearchChunkLike): number {
  const combined = typeof chunk.combined_score === "number" ? chunk.combined_score * 420 : 0;
  const similarity = Number.isFinite(chunk.similarity) ? chunk.similarity * 8 : 0;
  return Math.max(combined, similarity, 0);
}

function sourceFamily(profile: DocumentProfile | undefined): string {
  if (!profile) return "unknown";
  const haystack = normalizeText([profile.title, ...(profile.tags || [])].join(" "));
  if (/sei[- ]?rio/.test(haystack)) return "sei_rio";
  if (/federal/.test(haystack)) return "sei_federal";
  if (/(manual|guia)/.test(haystack)) return "manual";
  return profile.category || "generic";
}

export function assessSources(
  chunks: SearchChunkLike[],
  documentsById: Record<string, DocumentProfile>,
): SourceAssessment {
  const rankedChunks = chunks
    .map((chunk) => {
      const profile = documentsById[chunk.document_id];
      const bias = sourceBias(profile);
      return {
        ...chunk,
        resolved_title:
          profile?.title ||
          (typeof chunk.metadata?.title === "string" ? chunk.metadata.title : `Documento ${chunk.chunk_index + 1}`),
        source_bias: bias.score,
        final_score: retrievalScore(chunk) + bias.score,
        score_reasons: bias.reasons,
      } satisfies RankedChunk;
    })
    .sort((left, right) => right.final_score - left.final_score);

  const groupedByDocument = new Map<string, RankedChunk>();
  for (const chunk of rankedChunks) {
    const current = groupedByDocument.get(chunk.document_id);
    if (!current || chunk.final_score > current.final_score) {
      groupedByDocument.set(chunk.document_id, chunk);
    }
  }

  const topDocuments = Array.from(groupedByDocument.values()).sort(
    (left, right) => right.final_score - left.final_score,
  );

  const topScore = topDocuments[0]?.final_score ?? 0;
  const secondScore = topDocuments[1]?.final_score ?? 0;
  const averageScore =
    topDocuments.slice(0, 4).reduce((sum, item) => sum + item.final_score, 0) /
    Math.max(1, Math.min(4, topDocuments.length));

  const topFamily = sourceFamily(documentsById[topDocuments[0]?.document_id]);
  const secondFamily = sourceFamily(documentsById[topDocuments[1]?.document_id]);
  const closeCompetition = topDocuments.length >= 2 && Math.abs(topScore - secondScore) <= 1.35;
  const mixedApplicability = topDocuments.length >= 2 && topFamily !== secondFamily;

  const ambiguityDetected =
    topDocuments.length >= 2 &&
    closeCompetition &&
    (mixedApplicability || topDocuments[1].source_bias >= topDocuments[0].source_bias - 0.4);

  const lowConfidence = rankedChunks.length === 0 || topScore < 3.25 || averageScore < 3.1;
  const needsInternalExpansion =
    rankedChunks.length > 0 &&
    (lowConfidence || (ambiguityDetected && groupedByDocument.size < 6));

  return {
    rankedChunks,
    ambiguityDetected,
    lowConfidence,
    needsInternalExpansion,
    comparedTitles: topDocuments.slice(0, 3).map((item) => item.resolved_title),
    preferredTitles: topDocuments.slice(0, 2).map((item) => item.resolved_title),
    averageScore: Number.isFinite(averageScore) ? averageScore : 0,
  };
}

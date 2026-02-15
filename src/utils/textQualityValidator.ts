/**
 * Text Quality Validator for PDF Extraction
 * 
 * Detects gibberish/corrupted text from PDFs that have:
 * - Font encoding issues (common in Edge/Chrome "Print to PDF")
 * - Text converted to paths/outlines
 * - Unicode mapping errors
 * 
 * Uses multiple heuristics calibrated for Portuguese (PT-BR) text.
 */

export interface TextQualityResult {
  isValid: boolean;
  confidence: number; // 0-1
  issues: string[];
  metrics: {
    validWordRatio: number;
    avgWordLength: number;
    alphanumericRatio: number;
    entropyScore: number;
    suspiciousPatterns: number;
    commonWordHits: number;
  };
  recommendation: 'use_text' | 'try_ocr' | 'ask_user';
  textPreview: string; // First ~200 chars for user review
}

export interface ValidateOptions {
  expectedLanguage?: 'pt-BR' | 'en';
  minConfidence?: number;
}

// Thresholds calibrated for Portuguese text
const QUALITY_THRESHOLDS = {
  // Word validation
  MIN_VALID_WORD_RATIO: 0.55,      // 55% of "words" must have 2+ consecutive letters
  MIN_COMMON_WORD_RATIO: 0.05,    // At least 5% should be common PT-BR words
  
  // Character composition
  MIN_ALPHANUMERIC_RATIO: 0.60,   // 60% alphanumeric (letters, numbers, accents)
  
  // Word length (Portuguese average is ~5-6 chars)
  MIN_AVG_WORD_LENGTH: 2.5,
  MAX_AVG_WORD_LENGTH: 12,
  
  // Entropy (Shannon entropy for natural language ~4.0-5.0)
  ENTROPY_LOW: 2.5,               // Too low = repetition or error
  ENTROPY_HIGH: 6.5,              // Too high = random/binary data
  
  // Suspicious patterns
  MAX_SUSPICIOUS_PATTERNS: 3,
  
  // Confidence thresholds
  HIGH_CONFIDENCE: 0.75,
  LOW_CONFIDENCE: 0.45,
};

// Common Portuguese words for validation (top 100 most frequent)
const COMMON_WORDS_PT = new Set([
  // Articles and prepositions
  'de', 'da', 'do', 'das', 'dos', 'a', 'o', 'as', 'os', 'em', 'no', 'na', 'nos', 'nas',
  'para', 'por', 'com', 'sem', 'sob', 'sobre', 'entre', 'até', 'desde', 'contra',
  // Conjunctions
  'e', 'ou', 'mas', 'que', 'se', 'quando', 'como', 'porque', 'pois', 'porém', 'embora',
  // Pronouns
  'eu', 'tu', 'ele', 'ela', 'nós', 'eles', 'elas', 'você', 'vocês',
  'me', 'te', 'se', 'nos', 'lhe', 'lhes', 'isso', 'isto', 'aquilo',
  'esse', 'este', 'aquele', 'essa', 'esta', 'aquela', 'qual', 'quem',
  // Verbs (common conjugations)
  'é', 'são', 'foi', 'ser', 'está', 'estar', 'tem', 'ter', 'há', 'havia',
  'pode', 'podem', 'deve', 'devem', 'fazer', 'faz', 'vai', 'vão', 'ir',
  'será', 'seria', 'sendo', 'sido', 'tendo', 'tendo',
  // Adverbs and others
  'não', 'sim', 'mais', 'menos', 'muito', 'pouco', 'bem', 'mal', 'já', 'ainda',
  'também', 'apenas', 'só', 'sempre', 'nunca', 'agora', 'aqui', 'ali', 'onde',
  'assim', 'então', 'logo', 'depois', 'antes', 'durante',
  // Common nouns
  'ano', 'anos', 'dia', 'dias', 'vez', 'vezes', 'parte', 'forma', 'caso', 'tempo',
  'trabalho', 'vida', 'mundo', 'país', 'governo', 'empresa', 'pessoa', 'pessoas',
  // Numbers as words
  'um', 'uma', 'dois', 'duas', 'três', 'quatro', 'cinco', 'primeiro', 'segundo',
  // Articles/determiners
  'ao', 'à', 'aos', 'às', 'pelo', 'pela', 'pelos', 'pelas', 'seu', 'sua', 'seus', 'suas',
  'meu', 'minha', 'nosso', 'nossa', 'todo', 'toda', 'todos', 'todas', 'cada', 'outro', 'outra',
]);

// Common English words for fallback
const COMMON_WORDS_EN = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'is', 'are', 'was', 'were', 'been', 'being', 'has', 'had', 'having',
]);

// Patterns that indicate font mapping/encoding errors
const SUSPICIOUS_PATTERNS = [
  /[\x00-\x08\x0B\x0C\x0E-\x1F]{2,}/,    // Control characters (except tab, newline, CR)
  /[\uFFFD]{2,}/,                         // Unicode replacement characters
  /[a-zA-Z]{25,}/,                        // Absurdly long "words" (encoding concatenation)
  /[\u0080-\u009F]{3,}/,                  // C1 control characters (often bad encoding)
  /[^\x00-\x7F\u00A0-\u024F\u1E00-\u1EFF]{10,}/, // Long non-Latin sequences
  /(.)\1{10,}/,                           // Same character repeated 10+ times
  /[!@#$%^&*()_+=\[\]{}|\\;:'",.<>?\/]{8,}/, // Long sequences of special chars
  /\d{20,}/,                              // Very long number sequences (often errors)
];

/**
 * Calculate Shannon entropy of text
 * Natural language typically has entropy between 4.0-5.0
 */
function calculateEntropy(text: string): number {
  if (!text || text.length === 0) return 0;
  
  const freq: Record<string, number> = {};
  for (const char of text.toLowerCase()) {
    freq[char] = (freq[char] || 0) + 1;
  }
  
  const len = text.length;
  let entropy = 0;
  
  for (const count of Object.values(freq)) {
    const p = count / len;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }
  
  return entropy;
}

/**
 * Check if a token is a valid word (has consecutive letters)
 */
function isValidWord(token: string): boolean {
  // Must have at least 2 consecutive letters (any script)
  return /[a-zA-ZÀ-ÿ]{2,}/i.test(token);
}

/**
 * Extract words from text, normalizing for analysis
 */
function extractWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\-–—]+/)
    .map(w => w.replace(/^[^\wÀ-ÿ]+|[^\wÀ-ÿ]+$/g, '')) // Trim non-word chars
    .filter(w => w.length > 0);
}

/**
 * Count matches against common word list
 */
function countCommonWords(words: string[], language: 'pt-BR' | 'en'): number {
  const wordSet = language === 'pt-BR' ? COMMON_WORDS_PT : COMMON_WORDS_EN;
  return words.filter(w => wordSet.has(w)).length;
}

/**
 * Count suspicious patterns in text
 */
function countSuspiciousPatterns(text: string): number {
  let count = 0;
  for (const pattern of SUSPICIOUS_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      count += matches.length;
    }
  }
  return count;
}

/**
 * Calculate alphanumeric ratio (letters, numbers, common accents)
 */
function calculateAlphanumericRatio(text: string): number {
  if (!text || text.length === 0) return 0;
  
  // Count alphanumeric + accented letters + common punctuation
  const alphanumeric = text.match(/[a-zA-Z0-9À-ÿ]/g)?.length || 0;
  
  // Don't count whitespace in denominator
  const nonWhitespace = text.replace(/\s/g, '').length;
  
  return nonWhitespace > 0 ? alphanumeric / nonWhitespace : 0;
}

/**
 * Generate a clean preview of the text for user review
 */
function generatePreview(text: string, maxLength: number = 200): string {
  // Take from middle of document (skip headers)
  const start = Math.min(500, Math.floor(text.length / 4));
  const sample = text.slice(start, start + maxLength * 2);
  
  // Clean up whitespace
  const cleaned = sample.replace(/\s+/g, ' ').trim();
  
  return cleaned.slice(0, maxLength) + (cleaned.length > maxLength ? '...' : '');
}

/**
 * Main validation function
 */
export function validateTextQuality(
  text: string,
  options: ValidateOptions = {}
): TextQualityResult {
  const { expectedLanguage = 'pt-BR', minConfidence = 0.6 } = options;
  
  // Handle empty/very short text
  if (!text || text.trim().length < 50) {
    return {
      isValid: false,
      confidence: 0,
      issues: ['Texto muito curto ou vazio'],
      metrics: {
        validWordRatio: 0,
        avgWordLength: 0,
        alphanumericRatio: 0,
        entropyScore: 0,
        suspiciousPatterns: 0,
        commonWordHits: 0,
      },
      recommendation: 'try_ocr',
      textPreview: text?.slice(0, 200) || '',
    };
  }
  
  const issues: string[] = [];
  const words = extractWords(text);
  
  // Calculate metrics
  const validWords = words.filter(isValidWord);
  const validWordRatio = words.length > 0 ? validWords.length / words.length : 0;
  
  const totalWordLength = validWords.reduce((sum, w) => sum + w.length, 0);
  const avgWordLength = validWords.length > 0 ? totalWordLength / validWords.length : 0;
  
  const alphanumericRatio = calculateAlphanumericRatio(text);
  const entropyScore = calculateEntropy(text.slice(0, 10000)); // Sample for performance
  const suspiciousPatterns = countSuspiciousPatterns(text);
  const commonWordHits = countCommonWords(words, expectedLanguage);
  const commonWordRatio = words.length > 0 ? commonWordHits / words.length : 0;
  
  // Evaluate each metric
  let confidenceScore = 1.0;
  
  // Valid word ratio
  if (validWordRatio < QUALITY_THRESHOLDS.MIN_VALID_WORD_RATIO) {
    issues.push(`Baixa proporção de palavras válidas (${(validWordRatio * 100).toFixed(0)}%)`);
    confidenceScore -= 0.25;
  }
  
  // Common words
  if (commonWordRatio < QUALITY_THRESHOLDS.MIN_COMMON_WORD_RATIO) {
    issues.push(`Poucas palavras comuns encontradas (${(commonWordRatio * 100).toFixed(1)}%)`);
    confidenceScore -= 0.15;
  }
  
  // Alphanumeric ratio
  if (alphanumericRatio < QUALITY_THRESHOLDS.MIN_ALPHANUMERIC_RATIO) {
    issues.push(`Muitos caracteres especiais (${((1 - alphanumericRatio) * 100).toFixed(0)}% não-alfanuméricos)`);
    confidenceScore -= 0.2;
  }
  
  // Word length
  if (avgWordLength < QUALITY_THRESHOLDS.MIN_AVG_WORD_LENGTH) {
    issues.push(`Palavras muito curtas (média: ${avgWordLength.toFixed(1)} caracteres)`);
    confidenceScore -= 0.15;
  } else if (avgWordLength > QUALITY_THRESHOLDS.MAX_AVG_WORD_LENGTH) {
    issues.push(`Palavras muito longas (média: ${avgWordLength.toFixed(1)} caracteres)`);
    confidenceScore -= 0.2;
  }
  
  // Entropy
  if (entropyScore < QUALITY_THRESHOLDS.ENTROPY_LOW) {
    issues.push('Texto muito repetitivo ou uniforme');
    confidenceScore -= 0.15;
  } else if (entropyScore > QUALITY_THRESHOLDS.ENTROPY_HIGH) {
    issues.push('Texto parece conter dados binários ou aleatórios');
    confidenceScore -= 0.25;
  }
  
  // Suspicious patterns
  if (suspiciousPatterns > QUALITY_THRESHOLDS.MAX_SUSPICIOUS_PATTERNS) {
    issues.push(`Padrões suspeitos de encoding detectados (${suspiciousPatterns})`);
    confidenceScore -= 0.2;
  }
  
  // Clamp confidence
  const confidence = Math.max(0, Math.min(1, confidenceScore));
  
  // Determine recommendation
  let recommendation: 'use_text' | 'try_ocr' | 'ask_user';
  if (confidence >= QUALITY_THRESHOLDS.HIGH_CONFIDENCE) {
    recommendation = 'use_text';
  } else if (confidence <= QUALITY_THRESHOLDS.LOW_CONFIDENCE) {
    recommendation = 'try_ocr';
  } else {
    recommendation = 'ask_user';
  }
  
  const isValid = confidence >= minConfidence && issues.length <= 2;
  
  console.log(`[textQualityValidator] Analysis complete:`, {
    confidence: confidence.toFixed(2),
    isValid,
    recommendation,
    issues,
    metrics: {
      validWordRatio: validWordRatio.toFixed(2),
      avgWordLength: avgWordLength.toFixed(1),
      alphanumericRatio: alphanumericRatio.toFixed(2),
      entropyScore: entropyScore.toFixed(2),
      suspiciousPatterns,
      commonWordHits,
    },
  });
  
  return {
    isValid,
    confidence,
    issues,
    metrics: {
      validWordRatio,
      avgWordLength,
      alphanumericRatio,
      entropyScore,
      suspiciousPatterns,
      commonWordHits,
    },
    recommendation,
    textPreview: generatePreview(text),
  };
}

/**
 * Quick check if text likely needs OCR (fast heuristic)
 */
export function quickNeedsOcrCheck(text: string): boolean {
  if (!text || text.length < 100) return true;
  
  // Quick checks without full analysis
  const alphaRatio = calculateAlphanumericRatio(text.slice(0, 2000));
  if (alphaRatio < 0.5) return true;
  
  const suspiciousCount = countSuspiciousPatterns(text.slice(0, 5000));
  if (suspiciousCount > 5) return true;
  
  return false;
}

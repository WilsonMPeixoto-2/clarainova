import * as pdfjsLib from 'pdfjs-dist';

// Worker CDN (evita problemas de bundling)
pdfjsLib.GlobalWorkerOptions.workerSrc = 
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';

export interface PdfExtractionResult {
  fullText: string;
  pages: string[];
  totalPages: number;
  needsOcr: boolean;
  avgCharsPerPage: number;
  metrics: {
    totalChars: number;
    estimatedMB: number;
    emptyPages: number;
    lowContentPages: number;
  };
}

// Thresholds for OCR detection - more nuanced to avoid false positives
const OCR_THRESHOLDS = {
  MIN_AVG_CHARS_PER_PAGE: 50,        // Average chars per page below this triggers OCR consideration
  MIN_TOTAL_CHARS_THRESHOLD: 200,    // If total chars < this, likely scanned
  EMPTY_PAGE_THRESHOLD: 10,          // Pages with < this many chars are "empty"
  LOW_CONTENT_THRESHOLD: 50,         // Pages with < this many chars are "low content"
  EMPTY_PAGE_RATIO_TRIGGER: 0.5,     // If > 50% pages are empty, likely scanned
  TABLE_CONTENT_MIN: 30,             // Tables may have short text per cell but valid content
};

/**
 * Improved heuristic to detect if a PDF needs OCR
 * Avoids false positives for PDFs with tables, forms, or sparse content
 */
function detectNeedsOcr(pages: string[], totalPages: number): { needsOcr: boolean; metrics: PdfExtractionResult['metrics'] } {
  const totalChars = pages.reduce((sum, p) => sum + p.length, 0);
  const avgCharsPerPage = totalPages > 0 ? totalChars / totalPages : 0;
  const estimatedMB = (new TextEncoder().encode(pages.join('\n')).length) / (1024 * 1024);
  
  // Count empty and low content pages
  const emptyPages = pages.filter(p => p.length < OCR_THRESHOLDS.EMPTY_PAGE_THRESHOLD).length;
  const lowContentPages = pages.filter(p => p.length < OCR_THRESHOLDS.LOW_CONTENT_THRESHOLD).length;
  const emptyPageRatio = totalPages > 0 ? emptyPages / totalPages : 0;
  
  const metrics = {
    totalChars,
    estimatedMB: Math.round(estimatedMB * 100) / 100,
    emptyPages,
    lowContentPages
  };
  
  // Multiple conditions for OCR detection
  const conditions = {
    tooLowAverage: avgCharsPerPage < OCR_THRESHOLDS.MIN_AVG_CHARS_PER_PAGE,
    tooLowTotal: totalChars < OCR_THRESHOLDS.MIN_TOTAL_CHARS_THRESHOLD,
    tooManyEmptyPages: emptyPageRatio > OCR_THRESHOLDS.EMPTY_PAGE_RATIO_TRIGGER,
    allPagesEmpty: totalPages > 0 && pages.every(p => p.length < OCR_THRESHOLDS.EMPTY_PAGE_THRESHOLD)
  };
  
  // Refined logic:
  // - If ALL pages are essentially empty → definitely OCR
  // - If average is very low AND more than half pages are empty → likely OCR
  // - If total chars are extremely low for multi-page doc → likely OCR
  const needsOcr = 
    conditions.allPagesEmpty ||
    (conditions.tooLowAverage && conditions.tooManyEmptyPages) ||
    (totalPages > 3 && conditions.tooLowTotal);
  
  console.log(`[extractPdfText] OCR detection: avgChars=${avgCharsPerPage.toFixed(0)}, emptyRatio=${(emptyPageRatio * 100).toFixed(0)}%, totalChars=${totalChars}, needsOcr=${needsOcr}`);
  
  return { needsOcr, metrics };
}

/**
 * Extract text from a PDF file in the browser using PDF.js
 * This runs entirely client-side, avoiding backend timeouts for large PDFs
 */
export async function extractPdfTextClient(
  file: File,
  onProgress?: (percent: number) => void
): Promise<PdfExtractionResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const totalPages = pdf.numPages;
  const pages: string[] = [];
  
  for (let i = 1; i <= totalPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item: any) => item.str || '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      pages.push(text);
    } catch (pageError) {
      console.error(`[extractPdfText] Error on page ${i}:`, pageError);
      pages.push('');
    }
    
    if (onProgress) {
      onProgress(Math.round((i / totalPages) * 100));
    }
  }
  
  const fullText = pages
    .map((text, idx) => `--- Página ${idx + 1} ---\n\n${text}`)
    .join('\n\n');
  
  // Use improved heuristic
  const { needsOcr, metrics } = detectNeedsOcr(pages, totalPages);
  
  return {
    fullText,
    pages,
    totalPages,
    needsOcr,
    avgCharsPerPage: totalPages > 0 ? metrics.totalChars / totalPages : 0,
    metrics
  };
}

/**
 * Read text content from a TXT file
 */
export async function extractTxtContent(file: File): Promise<string> {
  return await file.text();
}

/**
 * Check if a file is a PDF
 */
export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/**
 * Check if a file is a TXT
 */
export function isTxtFile(file: File): boolean {
  return file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt');
}

/**
 * Check if a file is a DOCX
 */
export function isDocxFile(file: File): boolean {
  return (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.toLowerCase().endsWith('.docx')
  );
}

/**
 * Split text into batches for incremental upload
 * Returns batches that are safe to send over the network
 */
export function splitTextIntoBatches(
  fullText: string,
  batchSizeChars: number = 500_000 // ~500KB per batch
): string[] {
  const batches: string[] = [];
  
  if (fullText.length <= batchSizeChars) {
    return [fullText];
  }
  
  let start = 0;
  while (start < fullText.length) {
    let end = start + batchSizeChars;
    
    // Try to break at a page boundary
    if (end < fullText.length) {
      const pageBoundary = fullText.lastIndexOf('--- Página', end);
      if (pageBoundary > start + batchSizeChars / 2) {
        end = pageBoundary;
      }
    }
    
    batches.push(fullText.slice(start, end));
    start = end;
  }
  
  return batches;
}

/**
 * Calculate payload metrics for display
 */
export function calculatePayloadMetrics(text: string): {
  charCount: number;
  wordCount: number;
  estimatedMB: number;
  isLarge: boolean;
  warning: string | null;
} {
  const charCount = text.length;
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  const bytes = new TextEncoder().encode(text).length;
  const estimatedMB = bytes / (1024 * 1024);
  
  // Warnings for large payloads
  const WARN_MB = 2; // Warn above 2MB
  const MAX_MB = 10; // Error above 10MB
  
  let warning: string | null = null;
  if (estimatedMB > MAX_MB) {
    warning = `Texto muito grande (${estimatedMB.toFixed(1)}MB). Máximo recomendado: ${MAX_MB}MB. Considere dividir o documento.`;
  } else if (estimatedMB > WARN_MB) {
    warning = `Texto grande (${estimatedMB.toFixed(1)}MB). O processamento pode demorar.`;
  }
  
  return {
    charCount,
    wordCount,
    estimatedMB: Math.round(estimatedMB * 100) / 100,
    isLarge: estimatedMB > WARN_MB,
    warning
  };
}

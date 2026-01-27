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
  
  const totalChars = pages.reduce((sum, p) => sum + p.length, 0);
  const avgCharsPerPage = totalPages > 0 ? totalChars / totalPages : 0;
  
  // Heurística: PDFs escaneados têm pouco texto selecionável
  const MIN_CHARS_PER_PAGE = 100;
  const needsOcr = avgCharsPerPage < MIN_CHARS_PER_PAGE;
  
  return {
    fullText,
    pages,
    totalPages,
    needsOcr,
    avgCharsPerPage
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

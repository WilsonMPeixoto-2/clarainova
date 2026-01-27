import * as pdfjsLib from 'pdfjs-dist';

// Worker CDN (must match the version in extractPdfText.ts)
pdfjsLib.GlobalWorkerOptions.workerSrc = 
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';

export interface PageImage {
  pageNum: number;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Load a PDF document from a File
 */
export async function loadPdfDocument(file: File): Promise<pdfjsLib.PDFDocumentProxy> {
  const arrayBuffer = await file.arrayBuffer();
  return await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
}

/**
 * Render a single PDF page as a JPEG image (base64 data URL)
 * @param pdf - PDF document proxy
 * @param pageNum - Page number (1-indexed)
 * @param scale - Render scale (default 2.0 for good OCR quality)
 * @param quality - JPEG quality 0-1 (default 0.85)
 */
export async function renderPageAsImage(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  scale: number = 2.0,
  quality: number = 0.85
): Promise<PageImage> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  await page.render({ canvasContext: context, viewport }).promise;
  
  // Convert to base64 JPEG (smaller than PNG)
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  
  return {
    pageNum,
    dataUrl,
    width: viewport.width,
    height: viewport.height
  };
}

/**
 * Render multiple pages as images in batches
 * @param pdf - PDF document proxy
 * @param startPage - Starting page (1-indexed)
 * @param endPage - Ending page (1-indexed, inclusive)
 * @param onProgress - Progress callback (0-100)
 */
export async function renderPagesAsImages(
  pdf: pdfjsLib.PDFDocumentProxy,
  startPage: number,
  endPage: number,
  onProgress?: (percent: number) => void
): Promise<PageImage[]> {
  const images: PageImage[] = [];
  const totalPages = endPage - startPage + 1;
  
  for (let i = startPage; i <= endPage; i++) {
    try {
      const image = await renderPageAsImage(pdf, i);
      images.push(image);
    } catch (error) {
      console.error(`[renderPdfPages] Error rendering page ${i}:`, error);
      // Skip failed pages
    }
    
    if (onProgress) {
      const progress = Math.round(((i - startPage + 1) / totalPages) * 100);
      onProgress(progress);
    }
  }
  
  return images;
}

/**
 * Split pages into batches for incremental OCR processing
 * @param totalPages - Total number of pages
 * @param batchSize - Pages per batch (default 5)
 */
export function getPageBatches(
  totalPages: number,
  batchSize: number = 5
): Array<{ start: number; end: number }> {
  const batches: Array<{ start: number; end: number }> = [];
  
  for (let start = 1; start <= totalPages; start += batchSize) {
    const end = Math.min(start + batchSize - 1, totalPages);
    batches.push({ start, end });
  }
  
  return batches;
}

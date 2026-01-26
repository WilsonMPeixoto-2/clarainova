import { jsPDF } from "jspdf";
import claraLogoPdf from "@/assets/clara-logo-pdf.png";

interface ReportData {
  title: string;
  content: string;
  createdAt: Date;
}

// Function to load image and convert to base64 for jsPDF
async function loadImageAsBase64(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } else {
        reject(new Error("Could not get canvas context"));
      }
    };
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

export async function generateReportPdf(report: ReportData): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let currentY = margin;
  
  // Helper to add new page if needed
  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - 30) {
      doc.addPage();
      currentY = margin;
      return true;
    }
    return false;
  };
  
  // Try to load and add logo image
  try {
    const logoBase64 = await loadImageAsBase64(claraLogoPdf);
    // Add logo image - proportionally sized to fit header
    const logoWidth = 60;
    const logoHeight = 32; // Approximate aspect ratio
    doc.addImage(logoBase64, "PNG", margin, currentY - 5, logoWidth, logoHeight);
    currentY += logoHeight + 5;
  } catch (error) {
    // Fallback to text logo if image fails
    console.warn("Could not load logo image, using text fallback");
    doc.setTextColor(212, 165, 116); // Primary amber
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("CLARA", margin, currentY);
    currentY += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    doc.text("Consultora de Legislação e Apoio a Rotinas Administrativas", margin, currentY);
    currentY += 8;
  }
  
  // Date
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  const formattedDate = report.createdAt.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  doc.text(`Gerado em: ${formattedDate}`, margin, currentY);
  currentY += 4;
  
  // Separator line
  doc.setDrawColor(200);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 10;
  
  // Report title
  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(report.title.toUpperCase(), contentWidth);
  titleLines.forEach((line: string) => {
    checkPageBreak(8);
    doc.text(line, margin, currentY);
    currentY += 8;
  });
  currentY += 4;
  
  // Content - process markdown-like formatting
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  
  // Clean and format content
  const cleanContent = report.content
    .replace(/^#{1,6}\s+(.+)$/gm, "\n$1\n") // Convert headers to plain text with spacing
    .replace(/\*\*(.+?)\*\*/g, "$1")        // Remove bold markers (we'll handle styling differently)
    .replace(/\*(.+?)\*/g, "$1")            // Remove italic markers
    .replace(/`([^`]+)`/g, "$1")            // Remove inline code
    .replace(/```[\s\S]*?```/g, "")         // Remove code blocks
    .replace(/^\s*[-*]\s+/gm, "• ")         // Convert list markers to bullets
    .replace(/^\s*\d+\.\s+/gm, (match, offset, string) => {
      // Keep numbered lists but clean them up
      return match.trim() + " ";
    })
    .replace(/\n{3,}/g, "\n\n")             // Normalize multiple line breaks
    .trim();
  
  const lines = cleanContent.split('\n');
  
  lines.forEach((line) => {
    const trimmedLine = line.trim();
    
    if (!trimmedLine) {
      currentY += 4;
      return;
    }
    
    // Check if it's a header-like line (all caps or short line followed by content)
    const isHeader = trimmedLine.length < 60 && 
                     !trimmedLine.startsWith("•") && 
                     !trimmedLine.match(/^\d+\./) &&
                     trimmedLine.toUpperCase() === trimmedLine;
    
    if (isHeader) {
      checkPageBreak(10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(trimmedLine, margin, currentY);
      currentY += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
    } else if (trimmedLine.startsWith("•")) {
      // Bullet point
      const bulletContent = trimmedLine.substring(1).trim();
      const bulletLines = doc.splitTextToSize(bulletContent, contentWidth - 8);
      bulletLines.forEach((bulletLine: string, idx: number) => {
        checkPageBreak(6);
        if (idx === 0) {
          doc.text("•", margin + 2, currentY);
          doc.text(bulletLine, margin + 8, currentY);
        } else {
          doc.text(bulletLine, margin + 8, currentY);
        }
        currentY += 6;
      });
    } else if (trimmedLine.match(/^\d+\./)) {
      // Numbered item
      const contentLines = doc.splitTextToSize(trimmedLine, contentWidth - 4);
      contentLines.forEach((contentLine: string) => {
        checkPageBreak(6);
        doc.text(contentLine, margin + 4, currentY);
        currentY += 6;
      });
    } else {
      // Regular paragraph
      const paragraphLines = doc.splitTextToSize(trimmedLine, contentWidth);
      paragraphLines.forEach((paragraphLine: string) => {
        checkPageBreak(6);
        doc.text(paragraphLine, margin, currentY);
        currentY += 6;
      });
    }
  });
  
  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      "Documento gerado pela CLARA - Inteligência Administrativa", 
      margin, 
      pageHeight - 10
    );
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth - margin - 25,
      pageHeight - 10
    );
  }
  
  // Download
  const safeTitle = report.title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 50);
  const fileName = `clara-relatorio-${safeTitle}-${report.createdAt.toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
}

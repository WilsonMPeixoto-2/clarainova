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
  // Dynamically import jsPDF and logo only when needed (saves ~150KB from initial bundle)
  const [{ jsPDF }, { default: claraLogoPdf }] = await Promise.all([
    import("jspdf"),
    import("@/assets/clara-logo-pdf.png")
  ]);

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
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  
  const lines = report.content.split('\n');
  let inCodeBlock = false;
  let inTable = false;
  
  lines.forEach((line) => {
    const trimmedLine = line.trim();
    
    // Handle code blocks - skip them but add placeholder
    if (trimmedLine.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        checkPageBreak(8);
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, currentY - 2, contentWidth, 6, 'F');
        doc.setFont("courier", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text("[Bloco de código - ver documento original]", margin + 2, currentY + 2);
        currentY += 8;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(40);
      } else {
        inCodeBlock = false;
      }
      return;
    }
    
    if (inCodeBlock) return; // Skip code block content
    
    // Handle tables - detect and skip with placeholder
    if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
      if (!inTable) {
        inTable = true;
        checkPageBreak(8);
        doc.setFillColor(240, 248, 255);
        doc.rect(margin, currentY - 2, contentWidth, 6, 'F');
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text("[Tabela - ver documento original para formatação completa]", margin + 2, currentY + 2);
        currentY += 8;
        doc.setFontSize(10);
        doc.setTextColor(40);
      }
      return;
    } else {
      inTable = false;
    }
    
    // Empty lines
    if (!trimmedLine) {
      currentY += 3;
      return;
    }
    
    // H1 headers
    if (trimmedLine.startsWith('# ')) {
      checkPageBreak(12);
      currentY += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(0);
      const headerText = trimmedLine.substring(2);
      const headerLines = doc.splitTextToSize(headerText, contentWidth);
      headerLines.forEach((hl: string) => {
        doc.text(hl, margin, currentY);
        currentY += 7;
      });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(40);
      return;
    }
    
    // H2 headers
    if (trimmedLine.startsWith('## ')) {
      checkPageBreak(10);
      currentY += 3;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30);
      const headerText = trimmedLine.substring(3);
      const headerLines = doc.splitTextToSize(headerText, contentWidth);
      headerLines.forEach((hl: string) => {
        doc.text(hl, margin, currentY);
        currentY += 6;
      });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(40);
      return;
    }
    
    // H3+ headers
    if (trimmedLine.startsWith('### ')) {
      checkPageBreak(8);
      currentY += 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(50);
      const headerText = trimmedLine.substring(4);
      const headerLines = doc.splitTextToSize(headerText, contentWidth);
      headerLines.forEach((hl: string) => {
        doc.text(hl, margin, currentY);
        currentY += 5;
      });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(40);
      return;
    }
    
    // H4 headers
    if (trimmedLine.startsWith('#### ')) {
      checkPageBreak(8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      const headerText = trimmedLine.substring(5);
      const headerLines = doc.splitTextToSize(headerText, contentWidth);
      headerLines.forEach((hl: string) => {
        doc.text(hl, margin, currentY);
        currentY += 5;
      });
      doc.setFont("helvetica", "normal");
      return;
    }
    
    // Horizontal rule
    if (trimmedLine === '---' || trimmedLine === '***') {
      checkPageBreak(6);
      currentY += 2;
      doc.setDrawColor(200);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 4;
      return;
    }
    
    // Bullet points
    if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
      const bulletContent = trimmedLine.substring(2)
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/`([^`]+)`/g, "$1");
      const bulletLines = doc.splitTextToSize(bulletContent, contentWidth - 10);
      bulletLines.forEach((bulletLine: string, idx: number) => {
        checkPageBreak(5);
        if (idx === 0) {
          doc.text("•", margin + 2, currentY);
          doc.text(bulletLine, margin + 8, currentY);
        } else {
          doc.text(bulletLine, margin + 8, currentY);
        }
        currentY += 5;
      });
      return;
    }
    
    // Numbered items
    const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      const num = numberedMatch[1];
      const content = numberedMatch[2]
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/`([^`]+)`/g, "$1");
      const contentLines = doc.splitTextToSize(content, contentWidth - 12);
      contentLines.forEach((contentLine: string, idx: number) => {
        checkPageBreak(5);
        if (idx === 0) {
          doc.text(`${num}.`, margin + 2, currentY);
          doc.text(contentLine, margin + 10, currentY);
        } else {
          doc.text(contentLine, margin + 10, currentY);
        }
        currentY += 5;
      });
      return;
    }
    
    // Regular paragraph - clean inline formatting
    const cleanLine = trimmedLine
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); // Remove links but keep text
    
    const paragraphLines = doc.splitTextToSize(cleanLine, contentWidth);
    paragraphLines.forEach((paragraphLine: string) => {
      checkPageBreak(5);
      doc.text(paragraphLine, margin, currentY);
      currentY += 5;
    });
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

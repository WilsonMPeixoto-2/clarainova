import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileDown, Check, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";

interface DownloadPdfButtonProps {
  userQuery: string;
  assistantResponse: string;
  timestamp: Date;
  className?: string;
}

export function DownloadPdfButton({ 
  userQuery, 
  assistantResponse, 
  timestamp,
  className = "" 
}: DownloadPdfButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const handleDownload = useCallback(async () => {
    if (isDownloading) return;
    
    setIsDownloading(true);
    
    try {
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
      
      // Header
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("CLARA", margin, currentY);
      currentY += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80);
      doc.text("Consultora de Legislação e Apoio a Rotinas Administrativas", margin, currentY);
      currentY += 8;
      
      // Date
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      const formattedDate = timestamp.toLocaleString("pt-BR", {
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
      
      // User query section
      doc.setTextColor(0);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Sua pergunta:", margin, currentY);
      currentY += 6;
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(60);
      const queryLines = doc.splitTextToSize(`"${userQuery}"`, contentWidth);
      queryLines.forEach((line: string) => {
        checkPageBreak(6);
        doc.text(line, margin, currentY);
        currentY += 6;
      });
      currentY += 8;
      
      // Response section
      doc.setTextColor(0);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Resposta:", margin, currentY);
      currentY += 6;
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      
      // Clean markdown for plain text
      const cleanText = assistantResponse
        .replace(/\*\*(.+?)\*\*/g, "$1")  // Remove bold
        .replace(/\*(.+?)\*/g, "$1")      // Remove italic
        .replace(/`([^`]+)`/g, "$1")      // Remove inline code
        .replace(/```[\s\S]*?```/g, "")   // Remove code blocks
        .replace(/#{1,6}\s/g, "")         // Remove headings
        .replace(/\[([^\]]+)\]/g, "[$1]") // Keep citations
        .replace(/\n{3,}/g, "\n\n")       // Normalize line breaks
        .trim();
      
      const responseLines = doc.splitTextToSize(cleanText, contentWidth);
      responseLines.forEach((line: string) => {
        checkPageBreak(6);
        doc.text(line, margin, currentY);
        currentY += 6;
      });
      
      // Footer on last page
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
      const fileName = `clara-resposta-${timestamp.toISOString().split("T")[0]}.pdf`;
      doc.save(fileName);
      
      setDownloaded(true);
      toast({
        title: "PDF baixado!",
        description: "O arquivo foi salvo na sua pasta de downloads.",
      });
      
      setTimeout(() => setDownloaded(false), 2000);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Não foi possível gerar o arquivo. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  }, [userQuery, assistantResponse, timestamp, isDownloading]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDownload}
          disabled={isDownloading}
          className={`h-7 w-7 text-muted-foreground hover:text-foreground transition-colors ${className}`}
          aria-label={downloaded ? "PDF baixado!" : "Baixar como PDF"}
        >
          <AnimatePresence mode="wait">
            {isDownloading ? (
              <motion.div
                key="loading"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Loader2 className="w-4 h-4 animate-spin" />
              </motion.div>
            ) : downloaded ? (
              <motion.div
                key="check"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Check className="w-4 h-4 text-primary" />
              </motion.div>
            ) : (
              <motion.div
                key="download"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <FileDown className="w-4 h-4" />
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {isDownloading ? "Gerando PDF..." : downloaded ? "PDF baixado!" : "Baixar como PDF"}
      </TooltipContent>
    </Tooltip>
  );
}

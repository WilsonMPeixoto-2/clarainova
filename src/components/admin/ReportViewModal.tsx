import { FileText, X, FileDown, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { generateReportPdf } from "@/utils/generateReportPdf";
import { toast } from "@/hooks/use-toast";

interface Report {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

interface ReportViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: Report | null;
  onEdit: (report: Report) => void;
}

export function ReportViewModal({
  open,
  onOpenChange,
  report,
  onEdit,
}: ReportViewModalProps) {
  if (!report) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleDownloadPdf = () => {
    try {
      generateReportPdf({
        title: report.title,
        content: report.content,
        createdAt: new Date(report.created_at),
      });
      toast({
        title: "PDF baixado!",
        description: "O relatório foi salvo na sua pasta de downloads.",
      });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Não foi possível gerar o arquivo. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = () => {
    onOpenChange(false);
    onEdit(report);
  };

  // Simple markdown-to-html conversion for display
  const formatContent = (content: string) => {
    return content
      .split("\n")
      .map((line, index) => {
        const trimmed = line.trim();
        
        // Headers
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={index} className="text-base font-semibold mt-4 mb-2 text-foreground">
              {trimmed.substring(4)}
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={index} className="text-lg font-semibold mt-5 mb-2 text-foreground">
              {trimmed.substring(3)}
            </h3>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h2 key={index} className="text-xl font-bold mt-6 mb-3 text-foreground">
              {trimmed.substring(2)}
            </h2>
          );
        }
        
        // Bullet points
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <li key={index} className="ml-4 text-body">
              {formatInlineStyles(trimmed.substring(2))}
            </li>
          );
        }
        
        // Numbered lists
        const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
        if (numberedMatch) {
          return (
            <li key={index} className="ml-4 text-body list-decimal">
              {formatInlineStyles(numberedMatch[2])}
            </li>
          );
        }
        
        // Empty lines
        if (!trimmed) {
          return <div key={index} className="h-2" />;
        }
        
        // Regular paragraph
        return (
          <p key={index} className="text-body mb-1">
            {formatInlineStyles(trimmed)}
          </p>
        );
      });
  };

  // Handle inline styles like **bold** and *italic*
  const formatInlineStyles = (text: string) => {
    // This is a simplified version - for full markdown support, use a library
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="text-foreground font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={i}>{part.slice(1, -1)}</em>;
      }
      return part;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {report.title}
          </DialogTitle>
          <DialogDescription>
            Criado em {formatDate(report.created_at)}
            {report.updated_at !== report.created_at && (
              <> • Atualizado em {formatDate(report.updated_at)}</>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[60vh] pr-4">
          <div className="prose prose-sm dark:prose-invert max-w-none py-4">
            {formatContent(report.content)}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-2" />
            Fechar
          </Button>
          <Button variant="outline" onClick={handleEdit}>
            <Pencil className="w-4 h-4 mr-2" />
            Editar
          </Button>
          <Button onClick={handleDownloadPdf} className="btn-clara-primary">
            <FileDown className="w-4 h-4 mr-2" />
            Baixar PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

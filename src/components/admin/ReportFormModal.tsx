import { useState, useEffect } from "react";
import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Report {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

interface ReportFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report?: Report | null;
  onSave: (title: string, content: string) => Promise<void>;
  isSaving: boolean;
}

export function ReportFormModal({
  open,
  onOpenChange,
  report,
  onSave,
  isSaving,
}: ReportFormModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const isEditing = !!report;

  useEffect(() => {
    if (open) {
      if (report) {
        setTitle(report.title);
        setContent(report.content);
      } else {
        setTitle("");
        setContent("");
      }
    }
  }, [open, report]);

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;
    await onSave(title.trim(), content.trim());
  };

  const handleClose = () => {
    if (!isSaving) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="w-5 h-5 text-primary" />
            {isEditing ? "Editar Relatório" : "Novo Relatório de Desenvolvimento"}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Atualize as informações do relatório."
              : "Cole aqui o relatório de progresso do chat para salvá-lo no histórico."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="report-title">Título</Label>
            <Input
              id="report-title"
              placeholder="Ex: Melhorias de Performance - Janeiro 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSaving}
              className="bg-background/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-content">Conteúdo do Relatório</Label>
            <Textarea
              id="report-content"
              placeholder="Cole aqui o relatório de progresso..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isSaving}
              className="min-h-[300px] bg-background/50 font-mono text-sm resize-y"
            />
            <p className="text-xs text-muted-foreground">
              Suporta formatação Markdown (títulos, listas, negrito, etc.)
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={isSaving}
          >
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !title.trim() || !content.trim()}
            className="btn-clara-primary"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {isEditing ? "Atualizar" : "Salvar Relatório"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

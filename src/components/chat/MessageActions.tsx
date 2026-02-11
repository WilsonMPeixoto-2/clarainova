import { useState } from "react";
import { Copy, FileDown, Share2, Check, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";

interface MessageActionsProps {
  content: string;
  sources?: { documentTitle: string; section?: string; link?: string }[];
}

export function MessageActions({ content, sources }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Texto copiado!", {
        description: "Conteúdo copiado para a área de transferência.",
        duration: 2000,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar", { description: "Tente selecionar e copiar manualmente." });
    }
  };

  const handleDownloadPdf = () => {
    // Creates a simple text download as fallback (jsPDF can be integrated later)
    const blob = new Blob(
      [
        `CLARA — Consultora de Legislação e Apoio a Rotinas Administrativas\n${"=".repeat(60)}\n\n${content}\n\n${
          sources?.length
            ? `\nFontes Consultadas:\n${sources.map((s) => `• ${s.documentTitle}${s.section ? ` — ${s.section}` : ""}`).join("\n")}`
            : ""
        }\n\nDocumento gerado pela CLARA — Inteligência Administrativa\n${new Date().toLocaleString("pt-BR")}`,
      ],
      { type: "text/plain;charset=utf-8" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clara-resposta-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Download iniciado!", {
      description: "O arquivo foi gerado com sucesso.",
      duration: 2000,
    });
  };

  const handleShare = async () => {
    const shareText = `CLARA — Resposta:\n\n${content.slice(0, 500)}${content.length > 500 ? "..." : ""}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "CLARA — Resposta", text: shareText });
      } catch {
        // User cancelled share
      }
    } else {
      await navigator.clipboard.writeText(shareText);
      toast.success("Link copiado!", {
        description: "Conteúdo preparado para compartilhamento.",
        duration: 2000,
      });
    }
  };

  return (
    <div className="mt-4 pt-3 border-t border-border/30 flex gap-2 flex-wrap">
      <button
        onClick={handleCopy}
        className="group inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all duration-300
          bg-accent/10 text-accent hover:bg-accent/20
          hover:shadow-[0_0_16px_var(--accent-glow)] hover:-translate-y-0.5
          active:translate-y-0 active:shadow-none"
      >
        {copied ? (
          <Check className="size-4 animate-scale-in" />
        ) : (
          <Copy className="size-4 transition-transform group-hover:scale-110" />
        )}
        {copied ? "Copiado!" : "Copiar"}
      </button>

      <button
        onClick={handleDownloadPdf}
        className="group inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all duration-300
          bg-primary/10 text-primary hover:bg-primary/20
          hover:shadow-[0_0_16px_var(--primary-glow)] hover:-translate-y-0.5
          active:translate-y-0 active:shadow-none"
      >
        <FileDown className="size-4 transition-transform group-hover:scale-110" />
        PDF
      </button>

      <button
        onClick={handleShare}
        className="group inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all duration-300
          bg-complementar/10 text-complementar hover:bg-complementar/20
          hover:shadow-[0_0_16px_var(--complementar-glow)] hover:-translate-y-0.5
          active:translate-y-0 active:shadow-none"
      >
        <Share2 className="size-4 transition-transform group-hover:scale-110" />
        Compartilhar
      </button>
    </div>
  );
}

import { AlertCircle, FileWarning, Loader2, Eye, Sparkles } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { TextQualityResult } from '@/utils/textQualityValidator';

interface TextQualityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qualityResult: TextQualityResult | null;
  fileName: string;
  onUseText: () => void;
  onUseOcr: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export function TextQualityDialog({
  open,
  onOpenChange,
  qualityResult,
  fileName,
  onUseText,
  onUseOcr,
  onCancel,
  isProcessing = false,
}: TextQualityDialogProps) {
  if (!qualityResult) return null;

  const confidencePercent = Math.round(qualityResult.confidence * 100);
  const isOcrRecommended = qualityResult.recommendation === 'try_ocr';

  return (
    <AlertDialog open={open} onOpenChange={(o) => {
      if (!o && !isProcessing) {
        onOpenChange(o);
      }
    }}>
      <AlertDialogContent className="glass-card max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <FileWarning className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <AlertDialogTitle>Problemas Detectados no PDF</AlertDialogTitle>
            </div>
          </div>
          
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                O texto extraído de <span className="font-medium text-foreground">{fileName}</span> pode 
                estar corrompido ou com encoding incorreto.
              </p>

              {/* Quality meter */}
              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Qualidade do texto</span>
                  <Badge 
                    variant="secondary" 
                    className={
                      confidencePercent >= 70 
                        ? 'bg-green-500/20 text-green-400' 
                        : confidencePercent >= 50 
                          ? 'bg-amber-500/20 text-amber-400' 
                          : 'bg-destructive/20 text-destructive'
                    }
                  >
                    {confidencePercent}%
                  </Badge>
                </div>
                <Progress 
                  value={confidencePercent} 
                  className="h-2"
                />
              </div>

              {/* Issues list */}
              {qualityResult.issues.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    Problemas encontrados:
                  </p>
                  <ul className="space-y-1 pl-6">
                    {qualityResult.issues.map((issue, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground list-disc">
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Text preview */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Preview do texto extraído:
                </p>
                <div className="p-2 rounded bg-muted/30 border border-border/50 max-h-24 overflow-auto">
                  <code className="text-xs text-muted-foreground font-mono break-all">
                    {qualityResult.textPreview || '(sem preview)'}
                  </code>
                </div>
              </div>

              {/* Recommendation */}
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-sm font-medium text-primary flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4" />
                  Recomendação
                </p>
                <p className="text-sm text-foreground">
                  {isOcrRecommended ? (
                    <>
                      Usar <span className="font-semibold">OCR via IA</span> para extrair o texto 
                      a partir das imagens das páginas. Isso é mais lento, mas garante texto legível.
                    </>
                  ) : (
                    <>
                      O texto parece aceitável, mas pode conter erros. Você pode tentar usar o texto 
                      extraído ou optar por OCR via IA para melhor qualidade.
                    </>
                  )}
                </p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel 
            onClick={onCancel}
            disabled={isProcessing}
            className="sm:mr-auto"
          >
            Cancelar
          </AlertDialogCancel>
          
          <AlertDialogAction 
            onClick={onUseText}
            disabled={isProcessing}
            className="bg-transparent border border-border hover:bg-muted text-foreground"
          >
            Usar texto extraído
          </AlertDialogAction>
          
          <AlertDialogAction 
            onClick={onUseOcr}
            disabled={isProcessing}
            className={isOcrRecommended ? 'bg-primary hover:bg-primary/90' : 'bg-warning hover:bg-warning/90'}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Usar OCR {isOcrRecommended && '(recomendado)'}
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

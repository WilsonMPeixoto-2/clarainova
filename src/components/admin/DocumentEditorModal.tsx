import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, X, Plus, Tag, History, Save, Loader2, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentForEdit {
  id: string;
  title: string;
  tags?: string[] | null;
  version_label?: string | null;
  effective_date?: string | null;
  supersedes_document_id?: string | null;
}

interface DocumentListItem {
  id: string;
  title: string;
}

interface DocumentEditorModalProps {
  document: DocumentForEdit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  adminKey: string;
  allDocuments: DocumentListItem[];
}

export function DocumentEditorModal({
  document,
  open,
  onOpenChange,
  onSaved,
  adminKey,
  allDocuments,
}: DocumentEditorModalProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [versionLabel, setVersionLabel] = useState('');
  const [effectiveDate, setEffectiveDate] = useState<Date | undefined>();
  const [supersedesDocumentId, setSupersedesDocumentId] = useState<string>('');
  
  // Initialize form when document changes
  useEffect(() => {
    if (document) {
      setTags(document.tags || []);
      setVersionLabel(document.version_label || '');
      setEffectiveDate(document.effective_date ? new Date(document.effective_date) : undefined);
      setSupersedesDocumentId(document.supersedes_document_id || '');
    }
  }, [document]);
  
  // Filter out current document from supersedes options
  const supersedesOptions = useMemo(() => {
    return allDocuments.filter(d => d.id !== document?.id);
  }, [allDocuments, document?.id]);
  
  // Find documents that supersede this one (reverse lookup)
  const supersededBy = useMemo(() => {
    if (!document) return [];
    return allDocuments.filter(d => 
      (d as any).supersedes_document_id === document.id
    );
  }, [allDocuments, document?.id]);
  
  const handleAddTag = () => {
    const trimmed = newTag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setNewTag('');
    }
  };
  
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };
  
  const handleSave = async () => {
    if (!document) return;
    
    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from('documents')
        .update({
          tags: tags.length > 0 ? tags : null,
          version_label: versionLabel.trim() || null,
          effective_date: effectiveDate ? format(effectiveDate, 'yyyy-MM-dd') : null,
          supersedes_document_id: supersedesDocumentId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', document.id);
      
      if (error) throw error;
      
      toast({
        title: 'Documento atualizado',
        description: 'Metadados salvos com sucesso.',
      });
      
      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      console.error('[DocumentEditor] Save error:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message || 'Falha ao atualizar documento.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  if (!document) return null;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Editar Metadados
          </DialogTitle>
          <DialogDescription className="truncate">
            {document.title}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Tags Section */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Tags
            </Label>
            <div className="flex flex-wrap gap-2 min-h-[32px] p-2 rounded-md border border-input bg-background">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="gap-1 pr-1"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 hover:bg-muted rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              {tags.length === 0 && (
                <span className="text-sm text-muted-foreground">Nenhuma tag</span>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Nova tag..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAddTag}
                disabled={!newTag.trim()}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Version Label */}
          <div className="space-y-2">
            <Label htmlFor="version-label">Versão</Label>
            <Input
              id="version-label"
              placeholder="Ex: v2.0, Edição 2026, Rev. 3..."
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
            />
          </div>
          
          {/* Effective Date */}
          <div className="space-y-2">
            <Label>Data de Vigência</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !effectiveDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {effectiveDate ? format(effectiveDate, "PPP", { locale: ptBR }) : "Selecionar data..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={effectiveDate}
                  onSelect={setEffectiveDate}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {effectiveDate && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEffectiveDate(undefined)}
                className="text-xs text-muted-foreground"
              >
                Limpar data
              </Button>
            )}
          </div>
          
          {/* Supersedes Document */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              Substitui Documento
            </Label>
            <Select
              value={supersedesDocumentId}
              onValueChange={setSupersedesDocumentId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar documento anterior..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum</SelectItem>
                {supersedesOptions.map((doc) => (
                  <SelectItem key={doc.id} value={doc.id}>
                    {doc.title.length > 50 ? doc.title.substring(0, 50) + '...' : doc.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Indica que este documento substitui uma versão anterior
            </p>
          </div>
          
          {/* Superseded By (read-only info) */}
          {supersededBy.length > 0 && (
            <div className="space-y-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/30">
              <Label className="text-amber-500 text-sm">⚠️ Substituído por:</Label>
              <div className="space-y-1">
                {supersededBy.map((doc) => (
                  <p key={doc.id} className="text-sm text-amber-500/80">
                    • {doc.title}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salvar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

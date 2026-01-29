import { useState, useEffect, useCallback } from "react";
import { Plus, FileText, Eye, FileDown, Trash2, Search, RefreshCw, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ReportFormModal } from "./ReportFormModal";
import { ReportViewModal } from "./ReportViewModal";
import { generateReportPdf } from "@/utils/generateReportPdf";
import { ReportTagBadges, getTagColorClass, type ReportTag } from "./ReportTagSelector";
import { cn } from "@/lib/utils";

interface Report {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

interface ReportWithTags extends Report {
  tags: ReportTag[];
}

export function ReportsTab() {
  const [reports, setReports] = useState<ReportWithTags[]>([]);
  const [allTags, setAllTags] = useState<ReportTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilterTags, setSelectedFilterTags] = useState<string[]>([]);
  
  // Modal states
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  const [selectedReport, setSelectedReport] = useState<ReportWithTags | null>(null);
  const [reportToDelete, setReportToDelete] = useState<ReportWithTags | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch reports
      const { data: reportsData, error: reportsError } = await supabase
        .from("development_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (reportsError) throw reportsError;

      // Fetch all tags
      const { data: tagsData, error: tagsError } = await supabase
        .from("report_tags")
        .select("*")
        .order("name");

      if (tagsError) throw tagsError;
      setAllTags(tagsData || []);

      // Fetch tag relations
      const { data: relationsData, error: relationsError } = await supabase
        .from("report_tag_relations")
        .select("report_id, tag_id");

      if (relationsError) throw relationsError;

      // Map reports with their tags
      const reportsWithTags: ReportWithTags[] = (reportsData || []).map((report) => {
        const reportTagIds = (relationsData || [])
          .filter((r) => r.report_id === report.id)
          .map((r) => r.tag_id);
        const tags = (tagsData || []).filter((t) => reportTagIds.includes(t.id));
        return { ...report, tags };
      });

      setReports(reportsWithTags);
    } catch (error: any) {
      console.error("Error fetching reports:", error);
      toast({
        title: "Erro ao carregar relatórios",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleCreateNew = () => {
    setSelectedReport(null);
    setFormModalOpen(true);
  };

  const handleEdit = (report: ReportWithTags) => {
    setSelectedReport(report);
    setFormModalOpen(true);
  };

  const handleView = (report: ReportWithTags) => {
    setSelectedReport(report);
    setViewModalOpen(true);
  };

  const handleDownloadPdf = (report: ReportWithTags) => {
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

  const handleDeleteClick = (report: ReportWithTags) => {
    setReportToDelete(report);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!reportToDelete) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("development_reports")
        .delete()
        .eq("id", reportToDelete.id);

      if (error) throw error;

      setReports((prev) => prev.filter((r) => r.id !== reportToDelete.id));
      toast({
        title: "Relatório excluído",
        description: "O relatório foi removido permanentemente.",
      });
    } catch (error: any) {
      console.error("Error deleting report:", error);
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setReportToDelete(null);
    }
  };

  const handleSaveReport = async (title: string, content: string, tagIds: string[]) => {
    setIsSaving(true);
    try {
      // Generate summary from first 150 chars
      const summary = content.replace(/[#*`\n]/g, " ").trim().substring(0, 150);

      if (selectedReport) {
        // Update existing
        const { error } = await supabase
          .from("development_reports")
          .update({ title, content, summary })
          .eq("id", selectedReport.id);

        if (error) throw error;

        // Update tags: delete existing, insert new
        await supabase
          .from("report_tag_relations")
          .delete()
          .eq("report_id", selectedReport.id);

        if (tagIds.length > 0) {
          await supabase.from("report_tag_relations").insert(
            tagIds.map((tagId) => ({
              report_id: selectedReport.id,
              tag_id: tagId,
            }))
          );
        }

        const updatedTags = allTags.filter((t) => tagIds.includes(t.id));
        setReports((prev) =>
          prev.map((r) =>
            r.id === selectedReport.id
              ? { ...r, title, content, summary, updated_at: new Date().toISOString(), tags: updatedTags }
              : r
          )
        );
        toast({
          title: "Relatório atualizado",
          description: "As alterações foram salvas.",
        });
      } else {
        // Create new
        const { data, error } = await supabase
          .from("development_reports")
          .insert({ title, content, summary })
          .select()
          .single();

        if (error) throw error;

        // Insert tag relations
        if (tagIds.length > 0) {
          await supabase.from("report_tag_relations").insert(
            tagIds.map((tagId) => ({
              report_id: data.id,
              tag_id: tagId,
            }))
          );
        }

        const newTags = allTags.filter((t) => tagIds.includes(t.id));
        setReports((prev) => [{ ...data, tags: newTags }, ...prev]);
        toast({
          title: "Relatório salvo",
          description: "O relatório foi adicionado ao histórico.",
        });
      }

      setFormModalOpen(false);
      setSelectedReport(null);
    } catch (error: any) {
      console.error("Error saving report:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const toggleFilterTag = (tagId: string) => {
    setSelectedFilterTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const filteredReports = reports.filter((report) => {
    const matchesSearch =
      report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.content.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTags =
      selectedFilterTags.length === 0 ||
      selectedFilterTags.some((tagId) => report.tags.some((t) => t.id === tagId));

    return matchesSearch && matchesTags;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Relatórios de Desenvolvimento
              </CardTitle>
              <CardDescription>
                Histórico de relatórios de progresso do projeto
              </CardDescription>
            </div>
            <Button onClick={handleCreateNew} className="btn-clara-primary">
              <Plus className="w-4 h-4 mr-2" />
              Novo Relatório
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar relatórios..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background/50"
              />
            </div>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    selectedFilterTags.length > 0 && "border-primary text-primary"
                  )}
                >
                  <Filter className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="end">
                <div className="text-xs font-medium text-muted-foreground mb-2 px-1">
                  Filtrar por tag
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {allTags.map((tag) => {
                    const isSelected = selectedFilterTags.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => toggleFilterTag(tag.id)}
                        className={cn(
                          "text-xs px-2 py-1 rounded-md border transition-all",
                          getTagColorClass(tag.color),
                          isSelected && "ring-1 ring-primary/50"
                        )}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
                {selectedFilterTags.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2 text-xs"
                    onClick={() => setSelectedFilterTags([])}
                  >
                    Limpar filtros
                  </Button>
                )}
              </PopoverContent>
            </Popover>

            <Button
              variant="outline"
              size="icon"
              onClick={fetchReports}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reports List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filteredReports.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {searchQuery || selectedFilterTags.length > 0
                ? "Nenhum relatório encontrado"
                : "Nenhum relatório ainda"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || selectedFilterTags.length > 0
                ? "Tente uma busca diferente ou remova os filtros."
                : "Crie seu primeiro relatório para começar o histórico."}
            </p>
            {!searchQuery && selectedFilterTags.length === 0 && (
              <Button onClick={handleCreateNew} className="btn-clara-primary">
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeiro Relatório
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredReports.map((report) => (
            <Card key={report.id} className="glass-card hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-primary shrink-0" />
                      <h3 className="font-medium text-foreground truncate">
                        {report.title}
                      </h3>
                    </div>
                    {report.tags.length > 0 && (
                      <div className="mb-2">
                        <ReportTagBadges tags={report.tags} />
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {report.summary || report.content.substring(0, 150)}...
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(report.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleView(report)}
                      className="h-8 w-8"
                      title="Visualizar"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownloadPdf(report)}
                      className="h-8 w-8"
                      title="Baixar PDF"
                    >
                      <FileDown className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClick(report)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modals */}
      <ReportFormModal
        open={formModalOpen}
        onOpenChange={setFormModalOpen}
        report={selectedReport}
        onSave={handleSaveReport}
        isSaving={isSaving}
      />

      <ReportViewModal
        open={viewModalOpen}
        onOpenChange={setViewModalOpen}
        report={selectedReport}
        onEdit={handleEdit}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir relatório?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O relatório "{reportToDelete?.title}" será
              removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

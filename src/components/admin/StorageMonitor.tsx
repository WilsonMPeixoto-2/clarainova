import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Database, Trash2, RefreshCw, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface StorageStats {
  totalSessions: number;
  totalSizeBytes: number;
  oldestSession: string | null;
  newestSession: string | null;
}

const MAX_STORAGE_BYTES = 500 * 1024 * 1024; // 500MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getStorageStatus(percentage: number): {
  label: string;
  color: string;
  variant: "default" | "secondary" | "destructive" | "outline";
} {
  if (percentage < 20) return { label: "Saudável", color: "text-green-500", variant: "secondary" };
  if (percentage < 40) return { label: "Uso moderado", color: "text-green-500", variant: "secondary" };
  if (percentage < 60) return { label: "Atenção", color: "text-amber-500", variant: "outline" };
  if (percentage < 80) return { label: "Alerta", color: "text-orange-500", variant: "outline" };
  return { label: "Crítico", color: "text-destructive", variant: "destructive" };
}

export function StorageMonitor() {
  const { toast } = useToast();
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCleaning, setIsCleaning] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_chat_storage_stats");

      if (error) throw error;

      if (data && data.length > 0) {
        const row = data[0];
        setStats({
          totalSessions: Number(row.total_sessions) || 0,
          totalSizeBytes: Number(row.total_size_bytes) || 0,
          oldestSession: row.oldest_session,
          newestSession: row.newest_session,
        });
      } else {
        setStats({
          totalSessions: 0,
          totalSizeBytes: 0,
          oldestSession: null,
          newestSession: null,
        });
      }
    } catch (err: unknown) {
      console.error("[StorageMonitor] Error fetching stats:", err);
      toast({
        title: "Erro ao carregar estatísticas",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Preview how many sessions would be deleted
  const fetchPreview = useCallback(async () => {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);

      const { count, error } = await supabase
        .from("chat_sessions")
        .select("id", { count: "exact", head: true })
        .lt("updated_at", cutoffDate.toISOString());

      if (error) throw error;
      setPreviewCount(count || 0);
    } catch (err) {
      console.error("[StorageMonitor] Error fetching preview:", err);
      setPreviewCount(null);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchPreview();
  }, [fetchStats, fetchPreview]);

  const handleCleanup = async () => {
    setIsCleaning(true);
    try {
      const { data, error } = await supabase.rpc("cleanup_old_chat_sessions", {
        days_old: 90,
      });

      if (error) throw error;

      const deletedCount = data || 0;
      toast({
        title: "Limpeza concluída!",
        description: `${deletedCount} conversas antigas foram removidas.`,
      });

      await fetchStats();
      await fetchPreview();
    } catch (err: unknown) {
      console.error("[StorageMonitor] Error cleaning up:", err);
      toast({
        title: "Erro na limpeza",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsCleaning(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const usagePercentage = stats
    ? Math.min((stats.totalSizeBytes / MAX_STORAGE_BYTES) * 100, 100)
    : 0;
  const status = getStorageStatus(usagePercentage);

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="w-5 h-5 text-primary" />
              Uso de Recursos
            </CardTitle>
            <CardDescription className="mt-1">
              Monitoramento de armazenamento do histórico de conversas
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchStats}
              disabled={isLoading}
              className="h-8 w-8"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isCleaning || previewCount === 0}
                  className="gap-1"
                >
                  {isCleaning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Limpar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Limpar históricos antigos?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação removerá permanentemente todas as conversas com mais de 90 dias.
                    {previewCount !== null && previewCount > 0 && (
                      <span className="block mt-2 font-medium text-foreground">
                        {previewCount} {previewCount === 1 ? "conversa será removida" : "conversas serão removidas"}.
                      </span>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCleanup}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Confirmar Limpeza
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground">Total de Conversas</p>
            <p className="text-2xl font-bold text-foreground">
              {stats?.totalSessions || 0}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground">Armazenamento</p>
            <p className="text-2xl font-bold text-foreground">
              {formatBytes(stats?.totalSizeBytes || 0)}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {usagePercentage.toFixed(2)}% de 500 MB
            </span>
            <Badge variant={status.variant} className="gap-1">
              {usagePercentage >= 60 ? (
                <AlertTriangle className="w-3 h-3" />
              ) : (
                <CheckCircle className="w-3 h-3" />
              )}
              {status.label}
            </Badge>
          </div>
          <Progress value={usagePercentage} className="h-3" />
        </div>

        {/* Alert Thresholds */}
        <div className="flex flex-wrap gap-1">
          {[20, 40, 60, 80].map((threshold) => (
            <motion.div
              key={threshold}
              className={`px-2 py-1 rounded text-xs ${
                usagePercentage >= threshold
                  ? threshold >= 60
                    ? "bg-destructive/20 text-destructive"
                    : "bg-primary/20 text-primary"
                  : "bg-muted/50 text-muted-foreground"
              }`}
              animate={{
                scale: usagePercentage >= threshold ? [1, 1.05, 1] : 1,
              }}
              transition={{ duration: 0.3 }}
            >
              {threshold}%
            </motion.div>
          ))}
        </div>

        {/* Preview Info */}
        {previewCount !== null && previewCount > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            {previewCount} {previewCount === 1 ? "conversa" : "conversas"} com mais de 90 dias 
            {previewCount === 1 ? " pode" : " podem"} ser {previewCount === 1 ? "removida" : "removidas"}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

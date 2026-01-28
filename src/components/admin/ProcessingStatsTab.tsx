import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, AlertTriangle, CheckCircle, Clock, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ProcessingStat {
  step: string;
  avg_duration_ms: number;
  min_duration_ms: number;
  max_duration_ms: number;
  success_rate: number;
  total_count: number;
  failed_count: number;
}

interface RecentError {
  id: string;
  document_id: string;
  step: string;
  error_message: string;
  duration_ms: number;
  created_at: string;
  document_title: string;
}

interface DocumentForRetry {
  id: string;
  title: string;
  status: string;
  error_reason: string | null;
  last_batch_index: number | null;
  total_batches: number | null;
  updated_at: string;
}

const stepLabels: Record<string, string> = {
  upload: 'Upload',
  extract: 'Extração',
  ocr: 'OCR',
  chunk: 'Chunking',
  embed: 'Embeddings',
  db_insert: 'Banco de Dados',
};

export function ProcessingStatsTab({ adminKey }: { adminKey: string }) {
  const [stats, setStats] = useState<ProcessingStat[]>([]);
  const [errors, setErrors] = useState<RecentError[]>([]);
  const [retryDocs, setRetryDocs] = useState<DocumentForRetry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, errorsRes, retryRes] = await Promise.all([
        supabase.rpc('get_processing_stats', { p_days: 7 }),
        supabase.rpc('get_recent_processing_errors', { p_limit: 10 }),
        supabase.rpc('get_documents_for_retry'),
      ]);

      if (statsRes.data) setStats(statsRes.data);
      if (errorsRes.data) setErrors(errorsRes.data);
      if (retryRes.data) setRetryDocs(retryRes.data);
    } catch (error) {
      console.error('Error fetching processing stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Observabilidade</h2>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.step} className="bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                {stepLabels[stat.step] || stat.step}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Média:</span>
                <span className="font-mono">{formatDuration(stat.avg_duration_ms)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Taxa de Sucesso:</span>
                <Badge variant={stat.success_rate >= 95 ? 'default' : stat.success_rate >= 80 ? 'secondary' : 'destructive'}>
                  {stat.success_rate}%
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total:</span>
                <span>{stat.total_count} ({stat.failed_count} falhas)</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Documents for Retry */}
      {retryDocs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              Documentos Pendentes/Falhos
            </CardTitle>
            <CardDescription>
              Documentos que podem ser retomados ou reprocessados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {retryDocs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Status: {doc.status}
                      {doc.last_batch_index !== null && ` | Batch ${doc.last_batch_index}/${doc.total_batches}`}
                    </p>
                    {doc.error_reason && (
                      <p className="text-xs text-destructive mt-1">{doc.error_reason}</p>
                    )}
                  </div>
                  <Badge variant={doc.status === 'failed' ? 'destructive' : 'secondary'}>
                    {doc.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Errors */}
      {errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Erros Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {errors.map((err) => (
                <div key={err.id} className="p-3 bg-destructive/10 rounded-lg text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline">{stepLabels[err.step] || err.step}</Badge>
                    <span className="text-muted-foreground text-xs">
                      {new Date(err.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-destructive">{err.error_message}</p>
                  {err.document_title && (
                    <p className="text-xs text-muted-foreground mt-1">Doc: {err.document_title}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {stats.length === 0 && !loading && (
        <Card className="bg-card/50">
          <CardContent className="py-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhuma métrica de processamento ainda.</p>
            <p className="text-sm text-muted-foreground">As métricas aparecerão após processar documentos.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

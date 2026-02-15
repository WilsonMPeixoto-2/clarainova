import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Legend, AreaChart, Area 
} from 'recharts';
import { 
  Activity, Clock, AlertTriangle, TrendingUp, Zap, 
  Globe, Server, RefreshCw, AlertCircle 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

interface ChatMetricsSummary {
  date: string;
  total_requests: number;
  avg_embedding_ms: number | null;
  avg_search_ms: number | null;
  avg_llm_first_token_ms: number | null;
  avg_llm_total_ms: number | null;
  fallback_count: number;
  rate_limit_hits: number;
  gemini_count: number;
  lovable_count: number;
  web_search_count: number;
  error_count: number;
}

interface FrontendErrorsSummary {
  date: string;
  total_errors: number;
  unique_messages: number;
  chrome_count: number;
  firefox_count: number;
  safari_count: number;
  edge_count: number;
  mobile_count: number;
  other_count: number;
}

export function ChatMetricsDashboard() {
  const [chatMetrics, setChatMetrics] = useState<ChatMetricsSummary[]>([]);
  const [frontendErrors, setFrontendErrors] = useState<FrontendErrorsSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [chatResult, errorsResult] = await Promise.all([
        supabase.rpc('get_chat_metrics_summary', { p_days: 7 }),
        supabase.rpc('get_frontend_errors_summary', { p_days: 7 })
      ]);

      if (chatResult.error) throw chatResult.error;
      if (errorsResult.error) throw errorsResult.error;

      setChatMetrics((chatResult.data || []).reverse());
      setFrontendErrors((errorsResult.data || []).reverse());
    } catch (err: any) {
      console.error('[ChatMetricsDashboard] Error fetching metrics:', err);
      setError(err.message || 'Erro ao carregar métricas');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  // Calculate summary stats from the most recent data
  const todayMetrics = chatMetrics[chatMetrics.length - 1];
  const totalRequests = chatMetrics.reduce((sum, d) => sum + d.total_requests, 0);
  const totalFallbacks = chatMetrics.reduce((sum, d) => sum + d.fallback_count, 0);
  const totalRateLimits = chatMetrics.reduce((sum, d) => sum + d.rate_limit_hits, 0);
  const totalErrors = frontendErrors.reduce((sum, d) => sum + d.total_errors, 0);
  const fallbackRate = totalRequests > 0 ? ((totalFallbacks / totalRequests) * 100).toFixed(1) : '0';
  
  // Calculate average latencies across all days
  const avgLatencies = chatMetrics.length > 0 ? {
    embedding: Math.round(chatMetrics.reduce((sum, d) => sum + (d.avg_embedding_ms || 0), 0) / chatMetrics.length),
    search: Math.round(chatMetrics.reduce((sum, d) => sum + (d.avg_search_ms || 0), 0) / chatMetrics.length),
    llmFirstToken: Math.round(chatMetrics.reduce((sum, d) => sum + (d.avg_llm_first_token_ms || 0), 0) / chatMetrics.length),
    llmTotal: Math.round(chatMetrics.reduce((sum, d) => sum + (d.avg_llm_total_ms || 0), 0) / chatMetrics.length),
  } : null;

  // Prepare latency chart data
  const latencyChartData = chatMetrics.map(d => ({
    date: new Date(d.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    Embedding: d.avg_embedding_ms || 0,
    Busca: d.avg_search_ms || 0,
    'LLM (1º token)': d.avg_llm_first_token_ms || 0,
  }));

  // Prepare provider chart data
  const providerChartData = chatMetrics.map(d => ({
    date: new Date(d.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    Gemini: d.gemini_count,
    Lovable: d.lovable_count,
    'Web Search': d.web_search_count,
  }));

  // Alerts
  const alerts: { type: 'warning' | 'error'; message: string }[] = [];
  if (parseFloat(fallbackRate) > 20) {
    alerts.push({ type: 'error', message: `Taxa de fallback alta: ${fallbackRate}%` });
  }
  if (totalRateLimits > 10) {
    alerts.push({ type: 'warning', message: `${totalRateLimits} hits de rate limit nos últimos 7 dias` });
  }
  if (totalErrors > 5) {
    alerts.push({ type: 'warning', message: `${totalErrors} erros de frontend nos últimos 7 dias` });
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="glass-card">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="glass-card">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="glass-card">
        <CardContent className="py-12 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-destructive font-medium">{error}</p>
          <Button onClick={fetchMetrics} variant="outline" className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const hasData = chatMetrics.length > 0;

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 p-3 rounded-lg ${
                alert.type === 'error' 
                  ? 'bg-destructive/10 border border-destructive/30' 
                  : 'bg-amber-500/10 border border-amber-500/30'
              }`}
            >
              <AlertTriangle className={`w-5 h-5 ${alert.type === 'error' ? 'text-destructive' : 'text-amber-500'}`} />
              <span className={alert.type === 'error' ? 'text-destructive' : 'text-amber-500'}>
                {alert.message}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Total de Requests (7d)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalRequests}</p>
            {todayMetrics && (
              <p className="text-sm text-muted-foreground mt-1">
                {todayMetrics.total_requests} hoje
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Latência Média LLM
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {avgLatencies?.llmFirstToken || 0}
              <span className="text-lg text-muted-foreground">ms</span>
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              1º token • Total: {avgLatencies?.llmTotal || 0}ms
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Taxa de Fallback
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${parseFloat(fallbackRate) > 20 ? 'text-destructive' : ''}`}>
              {fallbackRate}%
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {totalFallbacks} de {totalRequests} requests
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Rate Limits + Erros
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {totalRateLimits + totalErrors}
            </p>
            <div className="flex gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                {totalRateLimits} RL
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {totalErrors} erros
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {hasData ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Latency Chart */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="w-5 h-5 text-primary" />
                Latência por Etapa (ms)
              </CardTitle>
              <CardDescription>
                Média diária de latência por componente do pipeline
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={latencyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="Embedding" fill="hsl(var(--primary))" stackId="a" />
                  <Bar dataKey="Busca" fill="hsl(var(--accent))" stackId="a" />
                  <Bar dataKey="LLM (1º token)" fill="hsl(220, 70%, 50%)" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Provider Distribution */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Server className="w-5 h-5 text-primary" />
                Distribuição de Providers
              </CardTitle>
              <CardDescription>
                Volume de requests por provider e uso de web search
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={providerChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="Gemini" stackId="1" fill="hsl(var(--primary))" stroke="hsl(var(--primary))" />
                  <Area type="monotone" dataKey="Lovable" stackId="1" fill="hsl(var(--accent))" stroke="hsl(var(--accent))" />
                  <Area type="monotone" dataKey="Web Search" stackId="2" fill="hsl(220, 70%, 50%)" stroke="hsl(220, 70%, 50%)" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="glass-card">
          <CardContent className="py-12 text-center">
            <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhuma métrica registrada ainda.</p>
            <p className="text-sm text-muted-foreground mt-1">
              As métricas serão exibidas após o primeiro chat.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button onClick={fetchMetrics} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar Métricas
        </Button>
      </div>
    </div>
  );
}

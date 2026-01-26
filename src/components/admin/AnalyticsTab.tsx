import { useState, useEffect, useMemo } from "react";
import { RefreshCw, Download, TrendingUp, TrendingDown, MessageSquare, ThumbsUp, ThumbsDown, Eye, Search, BarChart3 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FeedbackDetailModal } from "./FeedbackDetailModal";
import { StorageMonitor } from "./StorageMonitor";
import { UsageHeatmap } from "./UsageHeatmap";
import { KnowledgeGapAnalysis } from "./KnowledgeGapAnalysis";

interface QueryAnalytics {
  id: string;
  user_query: string;
  assistant_response: string;
  sources_cited: string[];
  created_at: string;
  session_fingerprint?: string | null;
}

interface ResponseFeedback {
  id: string;
  query_id: string;
  rating: boolean;
  feedback_category: string | null;
  feedback_text: string | null;
  created_at: string;
  query?: QueryAnalytics;
}

interface TopicCount {
  topic: string;
  count: number;
}

// Common Portuguese stop words to filter out
const STOP_WORDS = new Set([
  "a", "o", "e", "de", "da", "do", "que", "em", "um", "uma", "para", "com", "não",
  "por", "mais", "as", "os", "como", "se", "na", "no", "é", "eu", "ao", "ele",
  "ela", "isso", "esse", "essa", "qual", "quando", "muito", "nos", "já", "ser",
  "também", "pode", "esta", "este", "ou", "ter", "foi", "são", "tem", "sua",
  "seu", "pelo", "pela", "entre", "depois", "sobre", "mesmo", "até", "ela",
  "fazer", "quero", "sei", "saber", "preciso", "posso", "devo", "favor"
]);

// Keywords related to the CLARA domain
const DOMAIN_KEYWORDS = [
  "diária", "diárias", "sei", "sdp", "processo", "passagem", "passagens",
  "viagem", "afastamento", "pcdp", "proposta", "concessão", "prestação",
  "contas", "pagamento", "servidor", "solicitação", "documento", "prazo",
  "comprovante", "relatório", "formulário", "sistema", "cadastro", "autorização"
];

export function AnalyticsTab() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [queries, setQueries] = useState<QueryAnalytics[]>([]);
  const [feedbacks, setFeedbacks] = useState<ResponseFeedback[]>([]);
  const [selectedFeedback, setSelectedFeedback] = useState<ResponseFeedback | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch queries
      const { data: queriesData, error: queriesError } = await supabase
        .from("query_analytics")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (queriesError) throw queriesError;

      // Fetch feedbacks with query data
      const { data: feedbacksData, error: feedbacksError } = await supabase
        .from("response_feedback")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (feedbacksError) throw feedbacksError;

      setQueries(queriesData || []);
      
      // Merge feedbacks with their queries
      const feedbacksWithQueries = (feedbacksData || []).map(fb => ({
        ...fb,
        query: queriesData?.find(q => q.id === fb.query_id),
      }));
      setFeedbacks(feedbacksWithQueries);
    } catch (error: any) {
      console.error("[AnalyticsTab] Error fetching data:", error);
      toast({
        title: "Erro ao carregar analytics",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalQueries = queries.length;
    const totalFeedbacks = feedbacks.length;
    const positiveFeedbacks = feedbacks.filter(f => f.rating).length;
    const negativeFeedbacks = feedbacks.filter(f => !f.rating).length;
    const satisfactionRate = totalFeedbacks > 0 
      ? Math.round((positiveFeedbacks / totalFeedbacks) * 100) 
      : 0;

    return {
      totalQueries,
      totalFeedbacks,
      positiveFeedbacks,
      negativeFeedbacks,
      satisfactionRate,
    };
  }, [queries, feedbacks]);

  // Calculate daily feedback trend for chart (last 30 days)
  const feedbackTrendData = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Create a map for each day
    const dailyData: Record<string, { date: string; positive: number; negative: number }> = {};
    
    // Initialize last 30 days
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split("T")[0];
      const displayDate = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      dailyData[dateKey] = { date: displayDate, positive: 0, negative: 0 };
    }
    
    // Count feedbacks by day
    feedbacks.forEach(feedback => {
      const feedbackDate = new Date(feedback.created_at);
      if (feedbackDate >= thirtyDaysAgo) {
        const dateKey = feedbackDate.toISOString().split("T")[0];
        if (dailyData[dateKey]) {
          if (feedback.rating) {
            dailyData[dateKey].positive++;
          } else {
            dailyData[dateKey].negative++;
          }
        }
      }
    });
    
    return Object.values(dailyData);
  }, [feedbacks]);

  // Calculate top topics
  const topTopics = useMemo((): TopicCount[] => {
    const wordCounts: Record<string, number> = {};

    queries.forEach(query => {
      const words = query.user_query
        .toLowerCase()
        .replace(/[^\wàáâãéêíóôõúç\s]/g, " ")
        .split(/\s+/)
        .filter(word => word.length > 2 && !STOP_WORDS.has(word));

      words.forEach(word => {
        // Prioritize domain keywords
        const isDomainKeyword = DOMAIN_KEYWORDS.some(kw => 
          word.includes(kw) || kw.includes(word)
        );
        
        if (isDomainKeyword || word.length > 4) {
          wordCounts[word] = (wordCounts[word] || 0) + 1;
        }
      });
    });

    return Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count }));
  }, [queries]);

  // Negative feedbacks for audit
  const negativeFeedbackList = useMemo(() => {
    return feedbacks.filter(f => !f.rating);
  }, [feedbacks]);

  // Export to CSV
  const exportToCSV = () => {
    // Prepare queries CSV
    const queriesCSV = [
      ["ID", "Pergunta", "Resposta", "Fontes", "Data"].join(","),
      ...queries.map(q => [
        q.id,
        `"${q.user_query.replace(/"/g, '""')}"`,
        `"${q.assistant_response.replace(/"/g, '""').substring(0, 500)}"`,
        `"${(q.sources_cited || []).join("; ")}"`,
        new Date(q.created_at).toLocaleDateString("pt-BR"),
      ].join(","))
    ].join("\n");

    // Prepare feedbacks CSV
    const feedbacksCSV = [
      ["ID", "Query ID", "Avaliação", "Categoria", "Comentário", "Pergunta", "Data"].join(","),
      ...feedbacks.map(f => [
        f.id,
        f.query_id,
        f.rating ? "Positivo" : "Negativo",
        f.feedback_category || "",
        `"${(f.feedback_text || "").replace(/"/g, '""')}"`,
        `"${(f.query?.user_query || "").replace(/"/g, '""')}"`,
        new Date(f.created_at).toLocaleDateString("pt-BR"),
      ].join(","))
    ].join("\n");

    // Download queries
    const queriesBlob = new Blob([queriesCSV], { type: "text/csv;charset=utf-8;" });
    const queriesLink = document.createElement("a");
    queriesLink.href = URL.createObjectURL(queriesBlob);
    queriesLink.download = `clara-consultas-${new Date().toISOString().split("T")[0]}.csv`;
    queriesLink.click();

    // Download feedbacks
    setTimeout(() => {
      const feedbacksBlob = new Blob([feedbacksCSV], { type: "text/csv;charset=utf-8;" });
      const feedbacksLink = document.createElement("a");
      feedbacksLink.href = URL.createObjectURL(feedbacksBlob);
      feedbacksLink.download = `clara-feedbacks-${new Date().toISOString().split("T")[0]}.csv`;
      feedbacksLink.click();
    }, 500);

    toast({
      title: "Exportação iniciada",
      description: "Os arquivos CSV serão baixados em instantes.",
    });
  };

  const getCategoryLabel = (category: string | null): string => {
    const labels: Record<string, string> = {
      incorrect: "Informação incorreta",
      outdated: "Desatualizado",
      incomplete: "Incompleto",
      confusing: "Confuso",
      off_topic: "Não respondeu",
      other: "Outro",
    };
    return labels[category || ""] || category || "Sem categoria";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Analytics</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Consultas</p>
                <p className="text-3xl font-bold text-foreground">{metrics.totalQueries}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Satisfação</p>
                <p className="text-3xl font-bold text-foreground">{metrics.satisfactionRate}%</p>
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                metrics.satisfactionRate >= 70 ? "bg-green-500/20" : "bg-amber-500/20"
              }`}>
                {metrics.satisfactionRate >= 70 ? (
                  <TrendingUp className="w-6 h-6 text-green-500" />
                ) : (
                  <TrendingDown className="w-6 h-6 text-amber-500" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Positivos</p>
                <p className="text-3xl font-bold text-green-500">{metrics.positiveFeedbacks}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <ThumbsUp className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Negativos</p>
                <p className="text-3xl font-bold text-destructive">{metrics.negativeFeedbacks}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
                <ThumbsDown className="w-6 h-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feedback Trend Chart */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="w-5 h-5 text-primary" />
            Tendência de Feedbacks (últimos 30 dias)
          </CardTitle>
          <CardDescription>
            Evolução diária de avaliações positivas e negativas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {feedbackTrendData.every(d => d.positive === 0 && d.negative === 0) ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              Ainda não há feedbacks registrados nos últimos 30 dias.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={feedbackTrendData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  allowDecimals={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))'
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '10px' }}
                  formatter={(value) => <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>}
                />
                <Line 
                  type="monotone" 
                  dataKey="positive" 
                  name="Positivos"
                  stroke="hsl(142, 76%, 36%)" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(142, 76%, 36%)', strokeWidth: 0, r: 3 }}
                  activeDot={{ r: 5, fill: 'hsl(142, 76%, 36%)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="negative" 
                  name="Negativos"
                  stroke="hsl(var(--destructive))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--destructive))', strokeWidth: 0, r: 3 }}
                  activeDot={{ r: 5, fill: 'hsl(var(--destructive))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Topics */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Search className="w-5 h-5 text-primary" />
              Top 10 Tópicos Pesquisados
            </CardTitle>
            <CardDescription>
              Palavras mais frequentes nas perguntas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {topTopics.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                Ainda não há dados suficientes.
              </p>
            ) : (
              <div className="space-y-3">
                {topTopics.map((item, index) => (
                  <div key={item.topic} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-medium">
                      {index + 1}
                    </span>
                    <span className="flex-1 text-sm text-foreground capitalize">
                      {item.topic}
                    </span>
                    <Badge variant="secondary" className="bg-muted">
                      {item.count}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Negative Feedbacks */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ThumbsDown className="w-5 h-5 text-destructive" />
              Feedbacks Negativos Recentes
            </CardTitle>
            <CardDescription>
              Respostas que precisam de atenção
            </CardDescription>
          </CardHeader>
          <CardContent>
            {negativeFeedbackList.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                Nenhum feedback negativo registrado. 🎉
              </p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {negativeFeedbackList.slice(0, 10).map((feedback) => (
                  <div
                    key={feedback.id}
                    className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedFeedback(feedback)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-foreground line-clamp-2 flex-1">
                        {feedback.query?.user_query || "Pergunta não disponível"}
                      </p>
                      <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0">
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="destructive" className="text-xs">
                        {getCategoryLabel(feedback.feedback_category)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(feedback.created_at)}
                      </span>
                    </div>
                    {feedback.feedback_text && (
                      <p className="text-xs text-muted-foreground mt-2 italic line-clamp-1">
                        "{feedback.feedback_text}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Usage Heatmap */}
      <UsageHeatmap queries={queries} />

      {/* Knowledge Gap Analysis */}
      <KnowledgeGapAnalysis queries={queries} feedbacks={feedbacks} />

      {/* Storage Monitor */}
      <StorageMonitor />

      {/* Detail Modal */}
      <FeedbackDetailModal
        feedback={selectedFeedback}
        onClose={() => setSelectedFeedback(null)}
      />
    </div>
  );
}

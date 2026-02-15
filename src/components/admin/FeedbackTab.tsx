import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  MessageSquare,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";

interface FeedbackItem {
  id: string;
  query_id: string;
  rating: boolean;
  feedback_category: string | null;
  feedback_text: string | null;
  created_at: string;
  query?: {
    user_query: string;
    assistant_response: string;
  };
}

interface CategoryCount {
  category: string;
  count: number;
  label: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  incorrect: "Incorreto",
  outdated: "Desatualizado",
  incomplete: "Incompleto",
  confusing: "Confuso",
  off_topic: "Fora do tema",
  other: "Outro",
};

const CATEGORY_COLORS: Record<string, string> = {
  incorrect: "hsl(var(--destructive))",
  outdated: "hsl(var(--warning, 40 90% 50%))",
  incomplete: "hsl(var(--primary))",
  confusing: "hsl(var(--muted-foreground))",
  off_topic: "hsl(var(--secondary-foreground))",
  other: "hsl(var(--accent-foreground))",
};

export function FeedbackTab() {
  const [feedbackData, setFeedbackData] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<7 | 30 | 90>(30);

  // Fetch feedback data
  useEffect(() => {
    const fetchFeedback = async () => {
      setIsLoading(true);
      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - timeRange);

        // Fetch feedback with joined query data
        const { data: feedback, error } = await supabase
          .from("response_feedback")
          .select(`
            id,
            query_id,
            rating,
            feedback_category,
            feedback_text,
            created_at
          `)
          .gte("created_at", startDate.toISOString())
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) throw error;

        // Fetch related queries for negative feedback
        const negativeFeedback = feedback?.filter((f) => !f.rating) || [];
        const queryIds = negativeFeedback.map((f) => f.query_id);

        let queriesMap: Record<string, { user_query: string; assistant_response: string }> = {};

        if (queryIds.length > 0) {
          const { data: queries, error: queryError } = await supabase
            .from("query_analytics")
            .select("id, user_query, assistant_response")
            .in("id", queryIds);

          if (!queryError && queries) {
            queriesMap = queries.reduce(
              (acc, q) => ({
                ...acc,
                [q.id]: { user_query: q.user_query, assistant_response: q.assistant_response },
              }),
              {}
            );
          }
        }

        // Merge feedback with query data
        const enrichedFeedback = feedback?.map((f) => ({
          ...f,
          query: queriesMap[f.query_id],
        })) || [];

        setFeedbackData(enrichedFeedback);
      } catch (err) {
        console.error("[FeedbackTab] Error fetching feedback:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeedback();
  }, [timeRange]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const total = feedbackData.length;
    const positive = feedbackData.filter((f) => f.rating).length;
    const negative = total - positive;
    const positiveRate = total > 0 ? (positive / total) * 100 : 0;

    // Category breakdown for negative feedback
    const categoryBreakdown: Record<string, number> = {};
    feedbackData
      .filter((f) => !f.rating && f.feedback_category)
      .forEach((f) => {
        const cat = f.feedback_category!;
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
      });

    const categoryData: CategoryCount[] = Object.entries(categoryBreakdown)
      .map(([category, count]) => ({
        category,
        count,
        label: CATEGORY_LABELS[category] || category,
      }))
      .sort((a, b) => b.count - a.count);

    return { total, positive, negative, positiveRate, categoryData };
  }, [feedbackData]);

  // Negative feedback list
  const negativeFeedback = useMemo(
    () => feedbackData.filter((f) => !f.rating).slice(0, 20),
    [feedbackData]
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Feedback dos Usuários</h3>
        <div className="flex items-center gap-2">
          {([7, 30, 90] as const).map((days) => (
            <Button
              key={days}
              variant={timeRange === days ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange(days)}
            >
              {days}d
            </Button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Feedback</p>
                <p className="text-2xl font-bold">{metrics.total}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Positivos</p>
                <p className="text-2xl font-bold text-success">{metrics.positive}</p>
              </div>
              <ThumbsUp className="w-8 h-8 text-success/30" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Negativos</p>
                <p className="text-2xl font-bold text-destructive">{metrics.negative}</p>
              </div>
              <ThumbsDown className="w-8 h-8 text-destructive/30" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Aprovação</p>
                <p className="text-2xl font-bold">
                  {metrics.positiveRate.toFixed(1)}%
                </p>
              </div>
              <TrendingUp className={`w-8 h-8 ${metrics.positiveRate >= 80 ? "text-success/30" : metrics.positiveRate >= 50 ? "text-warning/30" : "text-destructive/30"}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown Chart */}
      {metrics.categoryData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              Categorias de Feedback Negativo
            </CardTitle>
            <CardDescription>
              Distribuição dos motivos de insatisfação
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={metrics.categoryData}
                  layout="vertical"
                  margin={{ left: 80, right: 20 }}
                >
                  <XAxis type="number" />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fontSize: 12 }}
                    width={75}
                  />
                  <Tooltip
                    formatter={(value: number) => [value, "Ocorrências"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {metrics.categoryData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CATEGORY_COLORS[entry.category] || "hsl(var(--primary))"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Negative Feedback */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ThumbsDown className="w-4 h-4 text-destructive" />
            Feedback Negativo Recente
          </CardTitle>
          <CardDescription>
            Últimas avaliações negativas com detalhes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {negativeFeedback.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ThumbsUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum feedback negativo no período selecionado.</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 pr-4">
                <AnimatePresence>
                  {negativeFeedback.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-lg bg-muted/30 border border-border/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {item.feedback_category && (
                              <Badge variant="secondary" className="text-xs">
                                {CATEGORY_LABELS[item.feedback_category] || item.feedback_category}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatDate(item.created_at)}
                            </span>
                          </div>

                          {item.feedback_text && (
                            <p className="text-sm mt-2 text-foreground/80">
                              "{item.feedback_text}"
                            </p>
                          )}

                          {item.query && (
                            <button
                              onClick={() =>
                                setExpandedId(expandedId === item.id ? null : item.id)
                              }
                              className="flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                            >
                              {expandedId === item.id ? (
                                <>
                                  <ChevronUp className="w-3 h-3" />
                                  Ocultar contexto
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-3 h-3" />
                                  Ver pergunta e resposta
                                </>
                              )}
                            </button>
                          )}

                          <AnimatePresence>
                            {expandedId === item.id && item.query && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="mt-3 space-y-2 overflow-hidden"
                              >
                                <div className="p-3 rounded bg-background/50">
                                  <p className="text-xs text-muted-foreground mb-1">
                                    Pergunta:
                                  </p>
                                  <p className="text-sm">
                                    {truncateText(item.query.user_query, 200)}
                                  </p>
                                </div>
                                <div className="p-3 rounded bg-background/50">
                                  <p className="text-xs text-muted-foreground mb-1">
                                    Resposta:
                                  </p>
                                  <p className="text-sm">
                                    {truncateText(item.query.assistant_response, 300)}
                                  </p>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

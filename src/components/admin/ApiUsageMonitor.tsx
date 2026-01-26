import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Sparkles, Zap, TrendingUp, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface ApiUsageSummary {
  provider: string;
  total_count: number;
  percentage: number;
}

interface ApiUsageDetail {
  provider: string;
  model: string;
  mode: string;
  total_count: number;
  date: string;
}

export function ApiUsageMonitor() {
  const [summary, setSummary] = useState<ApiUsageSummary[]>([]);
  const [details, setDetails] = useState<ApiUsageDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [days, setDays] = useState("7");

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch summary
      const { data: summaryData, error: summaryError } = await supabase
        .rpc("get_api_usage_summary", { p_days: parseInt(days) });

      if (summaryError) throw summaryError;
      setSummary(summaryData || []);

      // Fetch details
      const { data: detailsData, error: detailsError } = await supabase
        .rpc("get_api_usage_stats", { p_days: parseInt(days) });

      if (detailsError) throw detailsError;
      setDetails(detailsData || []);
    } catch (error) {
      console.error("Failed to fetch API usage stats:", error);
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const totalRequests = summary.reduce((acc, s) => acc + Number(s.total_count), 0);
  const geminiStats = summary.find(s => s.provider === "gemini");
  const lovableStats = summary.find(s => s.provider === "lovable");

  // Group details by date for the chart-like display
  const detailsByDate = details.reduce((acc, d) => {
    if (!acc[d.date]) acc[d.date] = [];
    acc[d.date].push(d);
    return acc;
  }, {} as Record<string, ApiUsageDetail[]>);

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="w-5 h-5 text-primary" />
              Uso das APIs
            </CardTitle>
            <CardDescription>
              Monitoramento de requisições Gemini vs Fallback
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Hoje</SelectItem>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchStats}
              disabled={isLoading}
              className="h-8 w-8"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : totalRequests === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhuma requisição registrada</p>
            <p className="text-sm">nos últimos {days} dias</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
              {/* Total */}
              <div className="bg-muted/30 rounded-lg p-3 text-center">
                <TrendingUp className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-2xl font-bold">{totalRequests}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>

              {/* Gemini */}
              <div className="bg-blue-500/10 rounded-lg p-3 text-center">
                <Sparkles className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                <p className="text-2xl font-bold text-blue-600">
                  {geminiStats?.total_count || 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  Gemini ({geminiStats?.percentage || 0}%)
                </p>
              </div>

              {/* Lovable Fallback */}
              <div className="bg-amber-500/10 rounded-lg p-3 text-center">
                <Zap className="w-5 h-5 mx-auto mb-1 text-amber-500" />
                <p className="text-2xl font-bold text-amber-600">
                  {lovableStats?.total_count || 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  Fallback ({lovableStats?.percentage || 0}%)
                </p>
              </div>
            </div>

            {/* Usage Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Distribuição de uso</span>
                <span>{days === "1" ? "Hoje" : `Últimos ${days} dias`}</span>
              </div>
              <div className="h-3 bg-muted/50 rounded-full overflow-hidden flex">
                {geminiStats && geminiStats.percentage > 0 && (
                  <div
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${geminiStats.percentage}%` }}
                  />
                )}
                {lovableStats && lovableStats.percentage > 0 && (
                  <div
                    className="h-full bg-amber-500 transition-all duration-500"
                    style={{ width: `${lovableStats.percentage}%` }}
                  />
                )}
              </div>
              <div className="flex justify-between text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>Gemini</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Fallback</span>
                </div>
              </div>
            </div>

            {/* Daily Breakdown */}
            {Object.keys(detailsByDate).length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Detalhamento por dia</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {Object.entries(detailsByDate)
                    .sort(([a], [b]) => b.localeCompare(a))
                    .slice(0, 7)
                    .map(([date, items]) => (
                      <div
                        key={date}
                        className="flex items-center justify-between p-2 bg-muted/20 rounded-lg text-sm"
                      >
                        <span className="text-muted-foreground">
                          {new Date(date).toLocaleDateString("pt-BR", {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                          })}
                        </span>
                        <div className="flex items-center gap-2">
                          {items.map((item, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className={`text-xs ${
                                item.provider === "gemini"
                                  ? "bg-blue-500/10 text-blue-600"
                                  : "bg-amber-500/10 text-amber-600"
                              }`}
                            >
                              {item.provider === "gemini" ? (
                                <Sparkles className="w-3 h-3 mr-1" />
                              ) : (
                                <Zap className="w-3 h-3 mr-1" />
                              )}
                              {item.total_count}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

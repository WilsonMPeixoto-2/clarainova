import { useMemo } from "react";
import { Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface QueryAnalytics {
  id: string;
  user_query: string;
  created_at: string;
}

interface UsageHeatmapProps {
  queries: QueryAnalytics[];
}

// Days of the week in Portuguese
const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Hours to display (6AM to 11PM)
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);

export function UsageHeatmap({ queries }: UsageHeatmapProps) {
  // Calculate heatmap data
  const heatmapData = useMemo(() => {
    // Initialize grid: 7 days x 18 hours (6AM-11PM)
    const grid: number[][] = Array.from({ length: 7 }, () => 
      Array.from({ length: 18 }, () => 0)
    );

    // Count queries by day and hour
    queries.forEach(query => {
      const date = new Date(query.created_at);
      const day = date.getDay(); // 0-6 (Sun-Sat)
      const hour = date.getHours();
      
      // Only count hours between 6AM and 11PM
      if (hour >= 6 && hour <= 23) {
        const hourIndex = hour - 6;
        grid[day][hourIndex]++;
      }
    });

    // Find max for color scaling
    const maxCount = Math.max(...grid.flat());

    return { grid, maxCount };
  }, [queries]);

  // Get color intensity based on count
  const getColor = (count: number, maxCount: number): string => {
    if (count === 0) return "bg-muted/30";
    
    const intensity = count / maxCount;
    
    if (intensity < 0.25) return "bg-primary/20";
    if (intensity < 0.5) return "bg-primary/40";
    if (intensity < 0.75) return "bg-primary/60";
    return "bg-primary/90";
  };

  // Calculate peak usage times
  const peakHours = useMemo(() => {
    const hourTotals: number[] = Array(18).fill(0);
    
    heatmapData.grid.forEach(day => {
      day.forEach((count, hourIdx) => {
        hourTotals[hourIdx] += count;
      });
    });

    // Find top 3 peak hours
    const sorted = hourTotals
      .map((count, idx) => ({ hour: idx + 6, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .filter(h => h.count > 0);

    return sorted;
  }, [heatmapData]);

  // Calculate busiest day
  const busiestDay = useMemo(() => {
    const dayTotals = heatmapData.grid.map((day, idx) => ({
      day: DAYS[idx],
      count: day.reduce((a, b) => a + b, 0)
    }));

    return dayTotals.sort((a, b) => b.count - a.count)[0];
  }, [heatmapData]);

  if (queries.length === 0) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="w-5 h-5 text-primary" />
            Heatmap de Uso por Horário
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm text-center py-8">
            Ainda não há dados suficientes para gerar o heatmap.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="w-5 h-5 text-primary" />
          Heatmap de Uso por Horário
        </CardTitle>
        <CardDescription>
          Distribuição de consultas por dia da semana e hora do dia
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Heatmap Grid */}
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Hour labels */}
            <div className="flex mb-1 ml-10">
              {HOURS.filter((_, i) => i % 3 === 0).map(hour => (
                <div 
                  key={hour} 
                  className="text-xs text-muted-foreground"
                  style={{ width: "48px" }}
                >
                  {hour}h
                </div>
              ))}
            </div>

            {/* Grid rows */}
            {DAYS.map((day, dayIdx) => (
              <div key={day} className="flex items-center gap-1 mb-1">
                <span className="w-8 text-xs text-muted-foreground text-right">
                  {day}
                </span>
                <div className="flex gap-[2px]">
                  {HOURS.map((hour, hourIdx) => {
                    const count = heatmapData.grid[dayIdx][hourIdx];
                    return (
                      <Tooltip key={hour}>
                        <TooltipTrigger asChild>
                          <div
                            className={`w-[28px] h-6 rounded-sm cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${getColor(count, heatmapData.maxCount)}`}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <p className="font-medium">{day}, {hour}h</p>
                          <p>{count} consulta{count !== 1 ? "s" : ""}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Legend */}
            <div className="flex items-center gap-2 mt-4 ml-10">
              <span className="text-xs text-muted-foreground">Menos</span>
              <div className="flex gap-[2px]">
                <div className="w-4 h-4 rounded-sm bg-muted/30" />
                <div className="w-4 h-4 rounded-sm bg-primary/20" />
                <div className="w-4 h-4 rounded-sm bg-primary/40" />
                <div className="w-4 h-4 rounded-sm bg-primary/60" />
                <div className="w-4 h-4 rounded-sm bg-primary/90" />
              </div>
              <span className="text-xs text-muted-foreground">Mais</span>
            </div>
          </div>
        </div>

        {/* Insights */}
        <div className="flex flex-wrap gap-4 pt-4 border-t border-border/50">
          {busiestDay && busiestDay.count > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Dia mais ativo:</span>
              <span className="text-sm font-medium text-primary">{busiestDay.day}</span>
              <span className="text-xs text-muted-foreground">({busiestDay.count} consultas)</span>
            </div>
          )}
          {peakHours.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Horários de pico:</span>
              {peakHours.map((peak, idx) => (
                <span key={peak.hour} className="text-sm font-medium text-primary">
                  {peak.hour}h{idx < peakHours.length - 1 ? "," : ""}
                </span>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

import { useMemo } from "react";
import { AlertTriangle, BookOpen, FileQuestion } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface QueryAnalytics {
  id: string;
  user_query: string;
  assistant_response: string;
  sources_cited: string[] | null;
  created_at: string;
}

interface ResponseFeedback {
  id: string;
  query_id: string;
  rating: boolean;
  feedback_category: string | null;
  created_at: string;
}

interface KnowledgeGapAnalysisProps {
  queries: QueryAnalytics[];
  feedbacks: ResponseFeedback[];
}

// Keywords that suggest knowledge gaps
const GAP_INDICATORS = [
  "não encontr", "não conseg", "não sei", "não localizei",
  "sem informação", "sem dados", "não há", "não possui",
  "não tenho", "indisponível", "não disponível",
  "não foi possível", "não existe", "não consta"
];

// Topic categorization keywords
const TOPIC_CATEGORIES: Record<string, string[]> = {
  "SEI/Processo": ["sei", "processo", "tramitação", "despacho", "assinatura", "documento"],
  "Diárias/Viagem": ["diária", "viagem", "afastamento", "pcdp", "passagem", "hospedagem"],
  "SDP/Pagamento": ["sdp", "pagamento", "empenho", "liquidação", "nota fiscal", "reembolso"],
  "Gestão de Pessoas": ["férias", "licença", "ponto", "frequência", "servidor", "nomeação"],
  "Licitação/Contratos": ["licitação", "contrato", "pregão", "dispensa", "ata", "edital"],
  "Legislação": ["lei", "decreto", "portaria", "resolução", "normativa", "instrução"],
};

export function KnowledgeGapAnalysis({ queries, feedbacks }: KnowledgeGapAnalysisProps) {
  // Analyze gaps in knowledge base
  const gapAnalysis = useMemo(() => {
    // Identify queries without sources
    const queriesWithoutSources = queries.filter(q => 
      !q.sources_cited || q.sources_cited.length === 0
    );

    // Identify responses with gap indicators
    const responsesWithGaps = queries.filter(q => 
      GAP_INDICATORS.some(indicator => 
        q.assistant_response.toLowerCase().includes(indicator)
      )
    );

    // Categorize negative feedbacks by topic
    const negativeByTopic: Record<string, number> = {};
    const negativeFeedbackIds = new Set(
      feedbacks.filter(f => !f.rating).map(f => f.query_id)
    );

    queries.forEach(query => {
      if (negativeFeedbackIds.has(query.id)) {
        const queryLower = query.user_query.toLowerCase();
        
        for (const [topic, keywords] of Object.entries(TOPIC_CATEGORIES)) {
          if (keywords.some(kw => queryLower.includes(kw))) {
            negativeByTopic[topic] = (negativeByTopic[topic] || 0) + 1;
            break;
          }
        }
      }
    });

    // Extract common patterns from queries without sources
    const unmatchedPatterns: Record<string, number> = {};
    queriesWithoutSources.forEach(query => {
      const words = query.user_query
        .toLowerCase()
        .replace(/[^\wàáâãéêíóôõúç\s]/g, " ")
        .split(/\s+/)
        .filter(w => w.length > 4);

      words.forEach(word => {
        unmatchedPatterns[word] = (unmatchedPatterns[word] || 0) + 1;
      });
    });

    // Get top unmatched patterns
    const topUnmatched = Object.entries(unmatchedPatterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([term, count]) => ({ term, count }));

    // Calculate topic coverage
    const topicCoverage: Record<string, { total: number; withSources: number }> = {};
    
    queries.forEach(query => {
      const queryLower = query.user_query.toLowerCase();
      const hasSources = query.sources_cited && query.sources_cited.length > 0;

      for (const [topic, keywords] of Object.entries(TOPIC_CATEGORIES)) {
        if (keywords.some(kw => queryLower.includes(kw))) {
          if (!topicCoverage[topic]) {
            topicCoverage[topic] = { total: 0, withSources: 0 };
          }
          topicCoverage[topic].total++;
          if (hasSources) {
            topicCoverage[topic].withSources++;
          }
          break;
        }
      }
    });

    // Calculate coverage percentages
    const coverageStats = Object.entries(topicCoverage)
      .map(([topic, stats]) => ({
        topic,
        total: stats.total,
        coverage: stats.total > 0 
          ? Math.round((stats.withSources / stats.total) * 100) 
          : 0,
        negativeCount: negativeByTopic[topic] || 0
      }))
      .sort((a, b) => a.coverage - b.coverage);

    return {
      queriesWithoutSources: queriesWithoutSources.length,
      responsesWithGaps: responsesWithGaps.length,
      totalQueries: queries.length,
      topUnmatched,
      coverageStats,
      negativeByTopic
    };
  }, [queries, feedbacks]);

  // Calculate gap percentage
  const gapPercentage = gapAnalysis.totalQueries > 0 
    ? Math.round((gapAnalysis.queriesWithoutSources / gapAnalysis.totalQueries) * 100)
    : 0;

  if (queries.length === 0) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileQuestion className="w-5 h-5 text-amber-500" />
            Análise de Lacunas de Conhecimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm text-center py-8">
            Ainda não há dados suficientes para análise.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileQuestion className="w-5 h-5 text-amber-500" />
          Análise de Lacunas de Conhecimento
        </CardTitle>
        <CardDescription>
          Identifica temas que precisam de mais documentação na base
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Gap Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">Sem fontes</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {gapAnalysis.queriesWithoutSources}
            </p>
            <p className="text-xs text-muted-foreground">
              {gapPercentage}% das consultas
            </p>
          </div>

          <div className="p-4 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 mb-1">
              <FileQuestion className="w-4 h-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">Respostas vagas</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {gapAnalysis.responsesWithGaps}
            </p>
            <p className="text-xs text-muted-foreground">
              Indicadores de lacuna
            </p>
          </div>

          <div className="p-4 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">Total analisado</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {gapAnalysis.totalQueries}
            </p>
            <p className="text-xs text-muted-foreground">
              consultas
            </p>
          </div>
        </div>

        {/* Topic Coverage */}
        {gapAnalysis.coverageStats.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">
              Cobertura por Tema
            </h4>
            <div className="space-y-3">
              {gapAnalysis.coverageStats.map(stat => (
                <div key={stat.topic} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{stat.topic}</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${
                        stat.coverage < 50 ? "text-amber-500" : 
                        stat.coverage < 75 ? "text-foreground" : 
                        "text-green-500"
                      }`}>
                        {stat.coverage}%
                      </span>
                      {stat.negativeCount > 0 && (
                        <Badge variant="destructive" className="text-xs h-5">
                          {stat.negativeCount} ⊖
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Progress 
                    value={stat.coverage} 
                    className={`h-2 ${
                      stat.coverage < 50 ? "[&>div]:bg-amber-500" : 
                      stat.coverage < 75 ? "[&>div]:bg-foreground" : 
                      "[&>div]:bg-green-500"
                    }`}
                  />
                  <p className="text-xs text-muted-foreground">
                    {stat.total} consultas neste tema
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unmatched Terms */}
        {gapAnalysis.topUnmatched.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">
              Termos Frequentes Sem Correspondência
            </h4>
            <p className="text-xs text-muted-foreground mb-3">
              Palavras comuns em consultas sem fontes - considere adicionar documentos sobre estes temas
            </p>
            <div className="flex flex-wrap gap-2">
              {gapAnalysis.topUnmatched.map(item => (
                <Badge 
                  key={item.term} 
                  variant="outline" 
                  className="bg-amber-500/10 border-amber-500/30 text-amber-600"
                >
                  {item.term}
                  <span className="ml-1 text-amber-500/70">({item.count})</span>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

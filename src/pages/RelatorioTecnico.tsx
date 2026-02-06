import { Link } from "wouter";
import {
  ArrowLeft,
  Database,
  Brain,
  Activity,
  Cloud,
  Code,
  FileText,
  Cpu,
  Search,
  Shield,
  Printer,
  Layers,
  Zap,
  Lock,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function Section({
  icon: Icon,
  number,
  title,
  accentColor,
  children,
}: {
  icon: React.ElementType;
  number: number;
  title: string;
  accentColor: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-xl overflow-hidden print:break-inside-avoid"
      style={{
        background: "oklch(0.16 0.04 250 / 0.4)",
        border: "1px solid oklch(0.95 0.01 250 / 0.08)",
      }}
    >
      <div
        className="flex items-center gap-3 px-5 py-4"
        style={{
          borderBottom: "1px solid oklch(0.95 0.01 250 / 0.06)",
          borderLeft: `3px solid ${accentColor}`,
        }}
      >
        <Icon className="size-5 text-primary" />
        <h2 className="text-base font-semibold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
          {number}. {title}
        </h2>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-border/10 last:border-0">
      <td className="py-2 text-sm text-muted-foreground">{label}</td>
      <td className="py-2 text-right">
        <Badge variant="secondary" className="bg-muted/60 text-foreground font-mono text-xs">
          {value}
        </Badge>
      </td>
    </tr>
  );
}

export default function RelatorioTecnico() {
  const handlePrint = () => window.print();

  return (
    <div
      className="min-h-screen text-foreground"
      style={{
        background:
          "radial-gradient(ellipse at 20% 0%, oklch(0.20 0.08 250 / 0.5) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, oklch(0.18 0.06 45 / 0.3) 0%, transparent 50%), oklch(0.11 0.03 250)",
      }}
    >
      {/* Header */}
      <header
        className="py-4 px-6 print:bg-white print:text-black print:border-b-2"
        style={{
          background: "oklch(0.14 0.04 250 / 0.8)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid oklch(0.95 0.01 250 / 0.08)",
        }}
      >
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground print:hidden">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-primary" />
              <div>
                <h1 className="text-lg font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                  Relatório Técnico
                </h1>
                <p className="text-xs text-muted-foreground">CLARA — Central de Inteligência SEI!RIO</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 print:hidden">
            <Badge className="bg-primary/15 text-primary border border-primary/25">Beta</Badge>
            <Button variant="outline" size="sm" onClick={handlePrint} className="border-border/40">
              <Printer className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
        {/* Meta */}
        <p className="text-center text-xs text-muted-foreground">
          <strong>Atualizado:</strong> 06/02/2026 &nbsp;|&nbsp;
          <strong>Versão:</strong> Beta &nbsp;|&nbsp;
          <strong>Projeto:</strong> CLARA
        </p>

        {/* 1. Hosting */}
        <Section icon={Cloud} number={1} title="Hospedagem e Deploy" accentColor="oklch(0.65 0.2 250)">
          <p className="text-sm text-muted-foreground leading-relaxed text-justify">
            A aplicação está hospedada na <strong className="text-foreground">Lovable Cloud</strong>,
            plataforma que integra frontend, backend (Edge Functions) e banco de dados PostgreSQL
            em um ambiente único e gerenciado. O deploy é contínuo via interface da Lovable.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline">1. Desenvolvimento</Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant="outline">2. Preview</Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant="outline">3. Publish</Badge>
            <span className="text-muted-foreground">→</span>
            <Badge className="bg-success/20 text-success border border-success/30">Produção</Badge>
          </div>
        </Section>

        {/* 2. Stack */}
        <Section icon={Code} number={2} title="Stack Tecnológica" accentColor="oklch(0.65 0.2 150)">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Layers className="size-3.5 text-primary" /> Frontend
              </h4>
              <table className="w-full text-sm">
                <tbody>
                  <InfoRow label="Framework" value="React 19" />
                  <InfoRow label="Bundler" value="Vite" />
                  <InfoRow label="Estilização" value="Tailwind CSS 4" />
                  <InfoRow label="Router" value="Wouter" />
                  <InfoRow label="UI" value="shadcn/ui + Radix" />
                  <InfoRow label="Linguagem" value="TypeScript" />
                </tbody>
              </table>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Server className="size-3.5 text-primary" /> Backend
              </h4>
              <table className="w-full text-sm">
                <tbody>
                  <InfoRow label="Runtime" value="Deno (Edge Functions)" />
                  <InfoRow label="Plataforma" value="Lovable Cloud" />
                  <InfoRow label="Banco" value="PostgreSQL + pgvector" />
                  <InfoRow label="Auth" value="Row Level Security" />
                  <InfoRow label="API" value="Supabase SDK" />
                </tbody>
              </table>
            </div>
          </div>
          <div
            className="p-3 rounded-lg font-mono text-xs space-y-1"
            style={{ background: "oklch(0.10 0.03 250 / 0.6)" }}
          >
            <p className="text-muted-foreground"># Arquivos principais</p>
            <p>
              src/pages/Home.tsx{" "}
              <span className="text-success">→ Interface do chat</span>
            </p>
            <p>
              supabase/functions/clara-chat/index.ts{" "}
              <span className="text-success">→ RAG + LLM (Edge Function)</span>
            </p>
          </div>
        </Section>

        {/* 3. Banco */}
        <Section icon={Database} number={3} title="Banco de Dados" accentColor="oklch(0.65 0.2 300)">
          <p className="text-sm text-muted-foreground leading-relaxed text-justify">
            PostgreSQL gerenciado com extensão <strong className="text-foreground">pgvector</strong>{" "}
            para armazenamento e busca de embeddings vetoriais. Índice HNSW para busca
            aproximada de vizinhos mais próximos.
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {[
              "documents",
              "document_chunks",
              "chat_sessions",
              "query_analytics",
              "response_feedback",
              "chat_metrics",
              "search_metrics",
              "profiles",
              "user_roles",
            ].map((t) => (
              <Badge key={t} variant="outline" className="font-mono py-1">
                {t}
              </Badge>
            ))}
          </div>
        </Section>

        {/* 4. RAG */}
        <Section icon={Search} number={4} title="RAG — Busca Híbrida" accentColor="oklch(0.70 0.18 45)">
          <p className="text-sm text-muted-foreground leading-relaxed text-justify">
            O sistema utiliza <strong className="text-foreground">busca híbrida</strong> que combina
            similaridade vetorial (pgvector HNSW) e pontuação por palavras-chave (tsvector).
            Os resultados são combinados via <strong className="text-foreground">Reciprocal Rank Fusion (K=60)</strong>{" "}
            com threshold de 0.3 para alta precisão.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Parâmetros</h4>
              <table className="w-full text-sm">
                <tbody>
                  <InfoRow label="Embedding" value="gemini-embedding-001" />
                  <InfoRow label="Dimensões" value="768" />
                  <InfoRow label="Threshold" value="0.3" />
                  <InfoRow label="Top-K" value="10 chunks" />
                  <InfoRow label="RRF K" value="60" />
                </tbody>
              </table>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">Base de Conhecimento</h4>
              <table className="w-full text-sm">
                <tbody>
                  <InfoRow label="Documentos" value="4 arquivos" />
                  <InfoRow label="Chunks indexados" value="47" />
                  <InfoRow label="Busca vetorial" value="pgvector HNSW" />
                  <InfoRow label="Busca textual" value="tsvector (pt)" />
                </tbody>
              </table>
            </div>
          </div>
        </Section>

        {/* 5. LLM */}
        <Section icon={Brain} number={5} title="Modelo de IA" accentColor="oklch(0.65 0.2 0)">
          <div className="grid md:grid-cols-2 gap-4">
            <div
              className="p-4 rounded-lg"
              style={{ background: "oklch(0.14 0.04 250 / 0.5)", border: "1px solid oklch(0.95 0.01 250 / 0.06)" }}
            >
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Cpu className="size-3.5" /> Provedor Primário
              </h4>
              <p className="font-mono text-xs text-primary mb-2">Lovable AI Gateway</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Modelo: <strong>gemini-3-flash-preview</strong></li>
                <li>• Temperature: <strong>0.3</strong></li>
                <li>• Max Tokens: <strong>2048</strong></li>
                <li>• Incluso na assinatura Lovable</li>
              </ul>
            </div>
            <div
              className="p-4 rounded-lg"
              style={{ background: "oklch(0.14 0.04 250 / 0.5)", border: "1px solid oklch(0.95 0.01 250 / 0.06)" }}
            >
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Zap className="size-3.5" /> Fallback
              </h4>
              <p className="font-mono text-xs text-muted-foreground mb-2">Google Gemini (direto)</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Modelo: <strong>gemini-2.0-flash</strong></li>
                <li>• Ativado em: HTTP 402, 429</li>
                <li>• Requer chave Gemini API</li>
              </ul>
            </div>
          </div>
        </Section>

        {/* 6. Segurança */}
        <Section icon={Shield} number={6} title="Segurança" accentColor="oklch(0.65 0.2 120)">
          <ul className="text-sm text-muted-foreground space-y-2 leading-relaxed">
            <li className="flex items-start gap-2">
              <Lock className="size-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong className="text-foreground">Row Level Security (RLS)</strong> ativo em todas as tabelas.
                Tabelas administrativas restritas a <code className="text-xs bg-muted/50 px-1 rounded">service_role</code>.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Shield className="size-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong className="text-foreground">Rate Limiting</strong> por fingerprint com
                função <code className="text-xs bg-muted/50 px-1 rounded">check_rate_limit</code> no banco.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Lock className="size-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong className="text-foreground">Edge Functions protegidas</strong> com
                validação <code className="text-xs bg-muted/50 px-1 rounded">x-admin-key</code> para operações administrativas.
              </span>
            </li>
          </ul>
        </Section>

        {/* 7. Métricas */}
        <Section icon={Activity} number={7} title="Observabilidade" accentColor="oklch(0.65 0.2 200)">
          <p className="text-sm text-muted-foreground leading-relaxed text-justify">
            O sistema registra métricas detalhadas de cada interação: latência de embedding,
            tempo de busca, tempo do LLM, provedor utilizado, chunks encontrados e erros.
            Disponível nas tabelas <code className="text-xs bg-muted/50 px-1 rounded">chat_metrics</code>,{" "}
            <code className="text-xs bg-muted/50 px-1 rounded">search_metrics</code> e{" "}
            <code className="text-xs bg-muted/50 px-1 rounded">query_analytics</code>.
          </p>
        </Section>

        {/* Footer disclaimer */}
        <div className="text-center text-xs text-muted-foreground/60 pt-4 pb-8">
          <p>© 2026 CLARA — Consultora de Legislação e Apoio a Rotinas Administrativas</p>
          <p className="mt-1">Documento gerado automaticamente. Versão de testes (Beta).</p>
        </div>
      </main>
    </div>
  );
}

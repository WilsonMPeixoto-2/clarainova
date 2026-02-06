import { Link } from "wouter";
import { 
  ArrowLeft, 
  Server, 
  Database, 
  Brain, 
  Settings, 
  Activity, 
  Github,
  Cloud,
  Code,
  FileText,
  Cpu,
  HardDrive,
  Search,
  Shield,
  Printer,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function RelatorioTecnico() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-[#1e3a5f] text-white py-4 px-6 print:bg-white print:text-black print:border-b-2 print:border-[#1e3a5f]">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 print:hidden">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar ao Chat
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8" />
              <div>
                <h1 className="text-xl font-bold">Relatório Técnico do Projeto</h1>
                <p className="text-sm text-slate-300 print:text-slate-600">Central de Inteligência SEI!RIO</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 print:hidden">
            <Badge variant="outline" className="bg-amber-500/20 text-amber-200 border-amber-400">
              Versão de testes (Beta)
            </Badge>
            <Button variant="outline" size="sm" onClick={handlePrint} className="text-white border-white/30 hover:bg-white/10">
              <Printer className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto py-8 px-4 max-w-6xl">
        {/* Meta Info */}
        <div className="mb-8 text-center print:text-left">
          <p className="text-slate-600 text-sm">
            <strong>Data:</strong> 12/01/2026 &nbsp;|&nbsp; 
            <strong>Versão:</strong> 2610ccdc &nbsp;|&nbsp; 
            <strong>Projeto:</strong> central-inteligencia-sei
          </p>
        </div>

        {/* Section 1: Hosting e Deploy */}
        <Card className="mb-6 border-l-4 border-l-blue-500 print:break-inside-avoid">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-[#1e3a5f]">
              <Cloud className="w-6 h-6" />
              1. Hosting e Deploy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-lg">
                <h4 className="font-semibold text-slate-700 mb-2">Infraestrutura</h4>
                <p className="text-sm text-slate-600 text-justify leading-relaxed">
                  O aplicativo está hospedado na <strong>Manus Platform (manus.space)</strong>, 
                  uma plataforma de hospedagem gerenciada que oferece ambiente de desenvolvimento 
                  sandbox e publicação simplificada.
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg">
                <h4 className="font-semibold text-slate-700 mb-2">Ambientes</h4>
                <ul className="text-sm text-slate-600 space-y-1">
                  <li>• <strong>Desenvolvimento:</strong> Sandbox com hot-reload</li>
                  <li>• <strong>Produção:</strong> Via botão "Publish" na Management UI</li>
                  <li>• <strong>Domínio customizado:</strong> Disponível via Settings → Domains</li>
                </ul>
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-2">Fluxo de Deploy</h4>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline" className="bg-white">1. Desenvolvimento</Badge>
                <span className="text-blue-400">→</span>
                <Badge variant="outline" className="bg-white">2. Checkpoint</Badge>
                <span className="text-blue-400">→</span>
                <Badge variant="outline" className="bg-white">3. Publish</Badge>
                <span className="text-blue-400">→</span>
                <Badge className="bg-green-500">Produção</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Stack */}
        <Card className="mb-6 border-l-4 border-l-green-500 print:break-inside-avoid">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-[#1e3a5f]">
              <Code className="w-6 h-6" />
              2. Stack (Frontend e Backend)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                  Frontend
                </h4>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-200">
                    <tr className="hover:bg-slate-50">
                      <td className="py-2 font-medium text-slate-600">Framework</td>
                      <td className="py-2 text-right"><Badge variant="secondary">React 19.2.1</Badge></td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2 font-medium text-slate-600">Bundler</td>
                      <td className="py-2 text-right"><Badge variant="secondary">Vite 7.1.7</Badge></td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2 font-medium text-slate-600">Estilização</td>
                      <td className="py-2 text-right"><Badge variant="secondary">Tailwind CSS 4.1.14</Badge></td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2 font-medium text-slate-600">Router</td>
                      <td className="py-2 text-right"><Badge variant="secondary">Wouter 3.3.5</Badge></td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2 font-medium text-slate-600">UI Components</td>
                      <td className="py-2 text-right"><Badge variant="secondary">shadcn/ui + Radix</Badge></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div>
                <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                  Backend
                </h4>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-200">
                    <tr className="hover:bg-slate-50">
                      <td className="py-2 font-medium text-slate-600">Runtime</td>
                      <td className="py-2 text-right"><Badge variant="secondary">Node.js 22.13.0</Badge></td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2 font-medium text-slate-600">Framework</td>
                      <td className="py-2 text-right"><Badge variant="secondary">Express 4.21.2</Badge></td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2 font-medium text-slate-600">API Layer</td>
                      <td className="py-2 text-right"><Badge variant="secondary">tRPC 11.6.0</Badge></td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2 font-medium text-slate-600">Validação</td>
                      <td className="py-2 text-right"><Badge variant="secondary">Zod 4.1.12</Badge></td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2 font-medium text-slate-600">Serialização</td>
                      <td className="py-2 text-right"><Badge variant="secondary">Superjson 1.13.3</Badge></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-slate-800 text-slate-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <p className="text-slate-400 mb-2"># Arquivos principais</p>
              <p>client/src/App.tsx          <span className="text-green-400">→ Rotas e layout</span></p>
              <p>client/src/pages/Home.tsx   <span className="text-green-400">→ Página com chat</span></p>
              <p>server/routers.ts           <span className="text-green-400">→ Procedures tRPC</span></p>
              <p>server/rag.ts               <span className="text-green-400">→ Lógica RAG</span></p>
              <p>server/_core/llm.ts         <span className="text-green-400">→ Configuração LLM</span></p>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Banco de Dados */}
        <Card className="mb-6 border-l-4 border-l-purple-500 print:break-inside-avoid">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-[#1e3a5f]">
              <Database className="w-6 h-6" />
              3. Banco de Dados e Armazenamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <HardDrive className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                <p className="font-semibold text-purple-800">MySQL / TiDB</p>
                <p className="text-xs text-purple-600">Serviço gerenciado</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <Code className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                <p className="font-semibold text-purple-800">Drizzle ORM</p>
                <p className="text-xs text-purple-600">v0.44.5</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <Settings className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                <p className="font-semibold text-purple-800">Drizzle Kit</p>
                <p className="text-xs text-purple-600">Migrações</p>
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-semibold text-slate-700 mb-2">Schema do Banco</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                <Badge variant="outline" className="justify-center py-2">users</Badge>
                <Badge variant="outline" className="justify-center py-2">documents</Badge>
                <Badge variant="outline" className="justify-center py-2">documentChunks</Badge>
                <Badge variant="outline" className="justify-center py-2">chatSessions</Badge>
                <Badge variant="outline" className="justify-center py-2">chatMessages</Badge>
              </div>
            </div>
            <div className="bg-slate-800 text-slate-100 p-3 rounded-lg font-mono text-xs">
              <span className="text-slate-400">$</span> pnpm db:push <span className="text-green-400"># Gera e aplica migrações</span>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: RAG */}
        <Card className="mb-6 border-l-4 border-l-orange-500 print:break-inside-avoid">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-[#1e3a5f]">
              <Search className="w-6 h-6" />
              4. RAG / Vector Store / Embeddings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <h4 className="font-semibold text-orange-800 mb-2">Pipeline de Busca</h4>
              <p className="text-sm text-orange-700 text-justify leading-relaxed">
                O sistema utiliza <strong>Multi-Query RAG</strong> com busca baseada em keywords e sinônimos, 
                sem dependência de vector store externo. A busca é otimizada para termos do SEI com 
                expansão automática de consultas.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-slate-700 mb-2">Parâmetros de Ingestão</h4>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="py-2 text-slate-600">Chunk Size</td>
                      <td className="py-2 text-right font-mono">4000 caracteres</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-600">Overlap</td>
                      <td className="py-2 text-right font-mono">500 caracteres</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-600">Top-K</td>
                      <td className="py-2 text-right font-mono">12 chunks</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-slate-600">Multi-Query</td>
                      <td className="py-2 text-right font-mono">6 variações</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div>
                <h4 className="font-semibold text-slate-700 mb-2">Algoritmo de Scoring</h4>
                <ul className="text-sm text-slate-600 space-y-1">
                  <li>• Matches de palavras-chave</li>
                  <li>• Termos SEI-específicos <Badge variant="secondary" className="ml-1">+3 pts</Badge></li>
                  <li>• Palavras de ação <Badge variant="secondary" className="ml-1">+2 pts</Badge></li>
                  <li>• Sinônimos expandidos automaticamente</li>
                </ul>
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-semibold text-slate-700 mb-2">Base de Conhecimento</h4>
              <p className="text-sm text-slate-600 mb-2">Localização: <code className="bg-slate-200 px-2 py-1 rounded">knowledge-base/</code></p>
              <div className="text-xs text-slate-500">
                4 arquivos PDF processados → 158 chunks indexados
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 5: LLM */}
        <Card className="mb-6 border-l-4 border-l-red-500 print:break-inside-avoid">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-[#1e3a5f]">
              <Brain className="w-6 h-6" />
              5. Configuração do LLM
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <h4 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                  <Cpu className="w-4 h-4" />
                  Modelo Primário
                </h4>
                <p className="font-mono text-sm text-red-700 mb-2">gemini-3-pro-preview</p>
                <ul className="text-xs text-red-600 space-y-1">
                  <li>• Temperature: <strong>0.5</strong></li>
                  <li>• Max Tokens: <strong>32768</strong></li>
                  <li>• Thinking Level: <strong>high</strong></li>
                  <li>• Thinking Budget: <strong>8192</strong></li>
                </ul>
              </div>
              <div className="bg-slate-100 p-4 rounded-lg border border-slate-300">
                <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Modelo Fallback
                </h4>
                <p className="font-mono text-sm text-slate-600 mb-2">gemini-1.5-pro-latest</p>
                <ul className="text-xs text-slate-500 space-y-1">
                  <li>• Ativado em: HTTP 429, 503, 500</li>
                  <li>• Thinking Budget: <strong>128</strong></li>
                </ul>
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-semibold text-slate-700 mb-2">Tools Habilitadas</h4>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Web Search (.gov.br)</Badge>
                <Badge variant="outline">rio.rj.gov.br</Badge>
                <Badge variant="outline">planalto.gov.br</Badge>
                <Badge variant="outline">camara.leg.br</Badge>
                <Badge variant="outline">senado.leg.br</Badge>
              </div>
            </div>
            <div className="bg-slate-800 text-slate-100 p-3 rounded-lg font-mono text-xs">
              <p className="text-slate-400"># Arquivos de configuração</p>
              <p>server/_core/llm.ts <span className="text-green-400">→ Linhas 283-320</span></p>
              <p>server/rag.ts <span className="text-green-400">→ Linhas 12-139 (System Prompt)</span></p>
            </div>
          </CardContent>
        </Card>

        {/* Section 6: Observabilidade */}
        <Card className="mb-6 border-l-4 border-l-cyan-500 print:break-inside-avoid">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-[#1e3a5f]">
              <Activity className="w-6 h-6" />
              6. Observabilidade e Logs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-cyan-50 p-4 rounded-lg text-center">
                <p className="font-semibold text-cyan-800">Logs</p>
                <p className="text-sm text-cyan-600">Console (stdout)</p>
              </div>
              <div className="bg-slate-100 p-4 rounded-lg text-center">
                <p className="font-semibold text-slate-700">Dashboard Analytics</p>
                <p className="text-sm text-slate-500">Não implementado</p>
              </div>
              <div className="bg-slate-100 p-4 rounded-lg text-center">
                <p className="font-semibold text-slate-700">Endpoint Admin</p>
                <p className="text-sm text-slate-500">Não implementado</p>
              </div>
            </div>
            <div className="bg-slate-800 text-slate-100 p-4 rounded-lg font-mono text-xs">
              <p className="text-slate-400 mb-2"># Exemplos de logs</p>
              <p><span className="text-cyan-400">[RAG]</span> Loaded 158 chunks from 4 files</p>
              <p><span className="text-cyan-400">[RAG]</span> Searching with 6 queries: [...]</p>
              <p><span className="text-yellow-400">[WebSearch]</span> Alternative search found 0 results</p>
            </div>
          </CardContent>
        </Card>

        {/* Section 7: GitHub */}
        <Card className="mb-6 border-l-4 border-l-slate-500 print:break-inside-avoid">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-[#1e3a5f]">
              <Github className="w-6 h-6" />
              7. Exportação para GitHub
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h4 className="font-semibold text-green-800 mb-2">✓ Export Nativo Disponível</h4>
              <p className="text-sm text-green-700">
                Acesse <strong>Settings → GitHub</strong> na Management UI para criar um novo repositório 
                com owner e nome selecionados.
              </p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-semibold text-slate-700 mb-3">Checklist de Segurança</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" defaultChecked disabled />
                  <span className="text-slate-600">Verificar .gitignore (node_modules, .env, dist)</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" disabled />
                  <span className="text-slate-600">Remover API keys hardcoded</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" disabled />
                  <span className="text-slate-600">Criar .env.example com variáveis necessárias</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="rounded" disabled />
                  <span className="text-slate-600">Verificar que .env não está no repositório</span>
                </div>
              </div>
            </div>
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
              <h4 className="font-semibold text-amber-800 mb-2">Variáveis de Ambiente Necessárias</h4>
              <div className="grid md:grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-white p-2 rounded">DATABASE_URL <span className="text-red-500">*</span></div>
                <div className="bg-white p-2 rounded">JWT_SECRET <span className="text-red-500">*</span></div>
                <div className="bg-white p-2 rounded">GOOGLE_GENERATIVE_AI_API_KEY</div>
                <div className="bg-white p-2 rounded">GOOGLE_SEARCH_API_KEY</div>
              </div>
              <p className="text-xs text-amber-600 mt-2"><span className="text-red-500">*</span> Obrigatórias</p>
            </div>
          </CardContent>
        </Card>

        {/* Architecture Diagram */}
        <Card className="mb-6 border-l-4 border-l-indigo-500 print:break-inside-avoid">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-[#1e3a5f]">
              <Server className="w-6 h-6" />
              Diagrama de Arquitetura
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-900 text-slate-100 p-6 rounded-lg font-mono text-xs overflow-x-auto">
              <pre className="whitespace-pre">{`
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (React 19)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Home.tsx  │  │  Tailwind   │  │   shadcn/ui + Radix │  │
│  │   (Chat UI) │  │   CSS 4     │  │      Components     │  │
│  └──────┬──────┘  └─────────────┘  └─────────────────────┘  │
│         │                                                    │
│         │ tRPC Client                                        │
└─────────┼───────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Express + tRPC)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  routers.ts │  │   rag.ts    │  │      llm.ts         │  │
│  │  (API)      │  │  (RAG)      │  │  (Gemini 3 Pro)     │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         ▼                ▼                     ▼             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Drizzle    │  │ knowledge-  │  │    webSearch.ts     │  │
│  │  ORM        │  │ base/*.txt  │  │  (Fallback .gov.br) │  │
│  └──────┬──────┘  └─────────────┘  └─────────────────────┘  │
└─────────┼───────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE (MySQL/TiDB)                     │
│  users │ documents │ documentChunks │ chatSessions │ msgs   │
└─────────────────────────────────────────────────────────────┘
              `}</pre>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-slate-500 mt-8 print:mt-4">
          <Separator className="mb-4" />
          <p>Documento gerado automaticamente em 12/01/2026</p>
          <p className="text-xs mt-1">Central de Inteligência SEI!RIO — Projeto em desenvolvimento pela 4ª CRE — Versão de testes</p>
        </div>
      </main>
    </div>
  );
}

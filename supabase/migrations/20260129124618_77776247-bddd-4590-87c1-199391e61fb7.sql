-- =============================================
-- Sistema de Tags para Relatórios de Desenvolvimento
-- =============================================

-- Tabela de tags
CREATE TABLE public.report_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT 'gray',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Relação many-to-many entre relatórios e tags
CREATE TABLE public.report_tag_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.development_reports(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.report_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(report_id, tag_id)
);

-- Índices para performance
CREATE INDEX idx_report_tag_relations_report_id ON public.report_tag_relations(report_id);
CREATE INDEX idx_report_tag_relations_tag_id ON public.report_tag_relations(tag_id);

-- =============================================
-- RLS Policies para report_tags
-- =============================================
ALTER TABLE public.report_tags ENABLE ROW LEVEL SECURITY;

-- Leitura pública (tags são metadados públicos)
CREATE POLICY "Tags are publicly readable"
  ON public.report_tags FOR SELECT
  USING (true);

-- Apenas admins podem gerenciar tags
CREATE POLICY "Admins can insert tags"
  ON public.report_tags FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update tags"
  ON public.report_tags FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete tags"
  ON public.report_tags FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- RLS Policies para report_tag_relations
-- =============================================
ALTER TABLE public.report_tag_relations ENABLE ROW LEVEL SECURITY;

-- Leitura pública
CREATE POLICY "Tag relations are publicly readable"
  ON public.report_tag_relations FOR SELECT
  USING (true);

-- Apenas admins podem gerenciar relações
CREATE POLICY "Admins can insert tag relations"
  ON public.report_tag_relations FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete tag relations"
  ON public.report_tag_relations FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- Tags Pré-definidas
-- =============================================
INSERT INTO public.report_tags (name, color) VALUES
  ('chat', 'blue'),
  ('ux', 'green'),
  ('premium', 'amber'),
  ('observabilidade', 'purple'),
  ('seguranca', 'red'),
  ('performance', 'cyan'),
  ('database', 'orange'),
  ('frontend', 'pink'),
  ('backend', 'slate'),
  ('hotfix', 'rose');

-- =============================================
-- Inserir Relatório "Chat Premium — Etapa 1"
-- =============================================
INSERT INTO public.development_reports (title, content, summary) VALUES (
  'Chat Premium — Etapa 1',
  E'# Relatório de Desenvolvimento — CLARA\n\n## Etapa: "Chat Premium (Consultoria acionável)"\n**Status:** ✅ Implementado e funcional\n**Data:** 2026-01-29\n\n---\n\n## 1. Visão Geral\n\nO projeto CLARA evoluiu a experiência do chat de "assistente funcional" para **consultoria premium acionável**, com:\n\n- Respostas mais escaneáveis (hierarquia tipográfica + divisórias elegantes)\n- Fontes em chips premium (local vs web, com glass effect e hover)\n- Modo de resposta semântico (Direto vs Didático) conectado ao comportamento do modelo\n- Transparência ativa via "notices" durante o streaming SSE\n- Ação de checklist (copia listas em formato acionável)\n- Resiliência de providers (fallback automático Gemini → Lovable AI Gateway)\n- Web Search Grounding ativado de forma criteriosa\n\n✅ **Marco:** Primeira resposta da CLARA gerada com sucesso mesmo sem base interna consolidada.\n\n---\n\n## 2. Novos Componentes Criados\n\n### 2.1 ChecklistButton.tsx\n**Caminho:** `src/components/chat/ChecklistButton.tsx`\n\n**Função:**\n- Detecta listas (bullet e numeradas) no conteúdo da resposta\n- Ao copiar, converte para checklist: `- item → [ ] item`\n- Tooltip explicativo\n- Ícone: ListChecks (Lucide)\n\n**Tecnologia:** React Hooks + Clipboard API + Regex\n\n### 2.2 ResponseNotice.tsx\n**Caminho:** `src/components/chat/ResponseNotice.tsx`\n\n**Função:**\n- Exibe avisos de transparência acima das respostas\n- Tipos: `web_search`, `limited_base`, `general_guidance`, `out_of_scope`, `info`\n\n**Tecnologia:** Framer Motion + ícones contextuais\n\n---\n\n## 3. Arquivos Modificados\n\n### 3.1 ChatMessage.tsx\n- Hierarquia visual para headers (`.chat-section-title`)\n- Divisórias elegantes para `---` (`.chat-divider`)\n- Integração do ChecklistButton nas ações\n- Integração do ResponseNotice\n- Redesign de SourcesSection com chips premium\n\n### 3.2 ResponseModeSelector.tsx\n- Renomeação: "Rápido" → **Direto** (Target) / "Análise Completa" → **Didático** (BookOpen)\n- Tooltips expandidos\n- Ajustes visuais\n\n### 3.3 useChat.ts\n- Novo `NoticeType` e interface `ChatNotice`\n- Campo `notice` incorporado ao tipo de mensagem\n- Processamento do evento SSE `notice`\n\n### 3.4 index.css\n```css\n.chat-section-title { border-left: 2px solid hsl(var(--primary) / 0.4); }\n.chat-divider { background: linear-gradient(...); }\n.source-chip-local { backdrop-filter: blur(8px); }\n.source-chip-web { background: primary/0.1; }\n```\n\n### 3.5 clara-chat/index.ts (Edge Function)\n- `MODE_INSTRUCTIONS` para Direto/Didático\n- Evento SSE `notice` implementado\n- Web Search Grounding refinado\n\n---\n\n## 4. Funcionalidades Técnicas\n\n### 4.1 Sistema Dual-Provider\n| Provider | Modelo (Direto) | Modelo (Didático) | Uso |\n|----------|-----------------|-------------------|-----|\n| Gemini (direto) | gemini-2.0-flash | gemini-1.5-pro | Primário |\n| Lovable AI Gateway | gemini-3-flash-preview | gemini-3-pro-preview | Fallback |\n\n### 4.2 Web Search Grounding\n- Ativa quando: RAG retorna 0 chunks ou avgScore < 0.015\n- Domínios confiáveis: `*.prefeitura.rio`, `doweb.rio.rj.gov.br`, `*.gov.br`, `tcm.rj.gov.br`\n\n### 4.3 Rate Limiting\n- 15 req/min por IP\n- Fallback gracioso: Gemini 429 → Lovable AI Gateway\n\n---\n\n## 5. Checklist de Implementação\n\n| Feature | Status | Arquivo |\n|---------|--------|--------|\n| Hierarquia visual | ✅ | ChatMessage.tsx |\n| Headers com borda | ✅ | .chat-section-title |\n| Divisórias elegantes | ✅ | .chat-divider |\n| Chips premium fontes | ✅ | ChatMessage.tsx |\n| Botão Checklist | ✅ | ChecklistButton.tsx |\n| Modos Direto/Didático | ✅ | ResponseModeSelector.tsx |\n| Instruções modo prompt | ✅ | clara-chat/index.ts |\n| Notices transparência | ✅ | ResponseNotice.tsx |\n| Fallback Gemini→Lovable | ✅ | clara-chat/index.ts |\n| Web Search Grounding | ✅ | clara-chat/index.ts |\n\n---\n\n## 6. Logs Confirmados\n\n```\n[clara-chat] RAG results: 0 chunks, avgScore: 0.0000, needsWebSearch: true\n[clara-chat] Google Search grounding enabled for this request\n[clara-chat] Using direct Gemini API with model: gemini-2.0-flash\n[clara-chat] Gemini rate limit hit (429), falling back to Lovable AI Gateway...\n[clara-chat] Using Lovable AI Gateway with model: google/gemini-3-flash-preview\n```\n\n✅ **Pipeline:** Query → RAG → Web Search → IA → SSE streaming operacional\n\n---\n\n## 7. Próximos Passos\n\n- [ ] Melhorias de "confiança por fontes" quando base interna consolidada\n- [ ] Tela de Base de Conhecimento premium\n- [ ] Admin premium com observabilidade\n- [ ] Governança documental (versionamento)',
  'Evolução do chat para consultoria premium acionável com hierarquia visual, chips de fontes, modos Direto/Didático, transparência via notices SSE, e resiliência de providers.'
);
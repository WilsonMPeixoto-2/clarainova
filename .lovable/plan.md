
# Plano de Implementacao: CLARA no Lovable Cloud

## Resumo Executivo

Migracao completa do backend `central-inteligencia-sei` para Lovable Cloud, preservando 100% da logica original e adicionando melhorias modernas.

**Componentes existentes que NAO serao alterados:**
- Header.tsx, HeroSection.tsx, FeaturesSection.tsx, Footer.tsx
- Index.tsx, index.css (design system completo)

---

## Arquitetura Final

```text
FRONTEND (React/Vite/Tailwind)
==============================
src/pages/
  - Index.tsx (INTOCADO)
  - Chat.tsx (NOVO) -----> Streaming + localStorage
  - Admin.tsx (NOVO) ----> Upload de documentos

src/components/chat/
  - ChatMessage.tsx -----> Markdown + citacoes
  - ChatInput.tsx -------> Textarea + envio
  - ThinkingIndicator.tsx -> Animacao "pensando"
  - SourceCitation.tsx --> Fontes locais e web


BACKEND (Edge Functions - Deno)
===============================
supabase/functions/
  - clara-chat/ ---------> RAG + Gemini + Search Grounding
  - documents/ ----------> Upload + processamento
  - search/ -------------> Busca semantica + keywords


DATABASE (PostgreSQL)
=====================
Tabelas:
  - documents -----------> Metadados dos arquivos
  - document_chunks -----> Fragmentos + embeddings pgvector

Storage:
  - knowledge-base/ -----> PDFs, DOCXs, TXTs originais
```

---

## Fase 1: Infraestrutura do Banco de Dados

### Tabela `documents`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | Chave primaria |
| title | text | Nome do documento |
| category | text | manual, cartilha, guia |
| file_path | text | Caminho no Storage |
| content_text | text | Texto extraido completo |
| created_at | timestamptz | Data de criacao |
| updated_at | timestamptz | Data de atualizacao |

### Tabela `document_chunks`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | Chave primaria |
| document_id | uuid | FK para documents |
| content | text | Fragmento de 4000 chars |
| chunk_index | integer | Ordem do fragmento |
| embedding | vector(768) | Embedding pgvector |
| metadata | jsonb | Titulo da secao, keywords |

### Extensao pgvector

Habilitaremos a extensao pgvector para busca semantica:
- Embeddings de 768 dimensoes (compativel com modelos Google)
- Indice HNSW para buscas rapidas
- Funcao de similaridade por cosseno

### Storage Bucket

- Nome: `knowledge-base`
- Arquivos: PDFs, DOCXs, TXTs originais
- Acesso publico para leitura

### Politicas RLS

- Leitura publica (sem autenticacao necessaria)
- Escrita protegida por chave admin (ADMIN_KEY)

---

## Fase 2: Edge Function de Chat (Core)

### Arquivo: `supabase/functions/clara-chat/index.ts`

Esta e a funcao principal que preserva 100% da logica do `server/rag.ts`.

### System Prompt Completo da CLARA

Sera copiado integralmente das linhas 22-178 do arquivo original:

- Personalidade empatica e pedagogica
- Especialista em SEI, SDP e 4a CRE
- Formato de resposta com citacoes
- Protocolos para queries fora do escopo
- Distincao entre SEI!RIO e Processo.Rio

### Mapa de Sinonimos

Preservado das linhas 185-247:

```text
"abrir" -> ["iniciar", "criar", "gerar", "cadastrar", "autuar"]
"anexar" -> ["incluir", "adicionar", "inserir"]
"processo" -> ["procedimento", "expediente", "autos"]
... (todos os 30+ mapeamentos)
```

### Algoritmo de Scoring

Preservado das linhas 432-476:

1. Match exato de frase: +15 pontos
2. Match de palavras individuais: +2 pontos cada
3. Termos SEI-especificos: +3 pontos
4. Palavras de acao em queries "como": +2 pontos

### Fluxo de Processamento

```text
1. Receber mensagem do usuario
2. Classificar intencao (CREATE_PROCESS, ADD_DOCUMENT, etc.)
3. Expandir termos com mapa de sinonimos
4. Gerar embeddings da query (para busca semantica)
5. Buscar chunks por:
   a. Similaridade vetorial (pgvector)
   b. Keywords (scoring tradicional)
   c. Combinar resultados (hybrid search)
6. Montar prompt com:
   - System Prompt da CLARA
   - Contexto dos chunks encontrados
   - Historico da conversa (enviado pelo frontend)
7. Chamar Gemini API com:
   - Modelo: gemini-3-pro-preview
   - Search Grounding: tools: [{ google_search: {} }]
   - Thinking mode habilitado
   - Streaming habilitado
8. Retornar stream SSE com:
   - Tokens da resposta
   - Metadados de thinking
   - Citacoes de fontes (locais e web)
```

### Configuracao do Gemini

```typescript
const model = genAI.getGenerativeModel({
  model: "gemini-3-pro-preview",
  generationConfig: {
    temperature: 0.5,
    maxOutputTokens: 32768,
    thinkingConfig: {
      thinkingBudget: 8192,
      thinkingLevel: "high"
    }
  },
  tools: [{ googleSearch: {} }]
});
```

### Formato de Resposta SSE

```text
event: thinking
data: {"status": "analyzing", "step": "Analisando pergunta..."}

event: thinking
data: {"status": "searching", "step": "Buscando na base de conhecimento..."}

event: delta
data: {"content": "De acordo com o"}

event: delta
data: {"content": " Manual do SEI 4.0..."}

event: sources
data: {"local": ["Manual SEI 4.0"], "web": ["gov.br/..."]}

event: done
data: {}
```

---

## Fase 3: Edge Function de Documentos

### Arquivo: `supabase/functions/documents/index.ts`

### Endpoints

**POST /documents**
- Upload de arquivo (PDF, DOCX, TXT)
- Extracao de texto
- Geracao de embeddings
- Divisao em chunks de 4000 caracteres
- Salvamento no banco e Storage

**GET /documents**
- Lista todos os documentos da base
- Retorna metadados e status

**DELETE /documents/:id**
- Remove documento, chunks e arquivo
- Requer ADMIN_KEY

### Processamento de Arquivos

```text
1. Receber arquivo via FormData
2. Validar tipo (PDF, DOCX, TXT)
3. Salvar no Storage bucket
4. Extrair texto:
   - PDF: biblioteca pdf-parse
   - DOCX: biblioteca mammoth
   - TXT: leitura direta
5. Dividir em chunks:
   - Tamanho: 4000 caracteres
   - Overlap: 500 caracteres
6. Gerar embeddings para cada chunk
7. Salvar documento e chunks no banco
8. Retornar status de sucesso
```

---

## Fase 4: Edge Function de Busca

### Arquivo: `supabase/functions/search/index.ts`

### Busca Hibrida (Melhoria)

Combina busca semantica (pgvector) com keywords (original):

```text
1. Receber query do usuario
2. Gerar embedding da query
3. Busca semantica:
   - Similaridade por cosseno no pgvector
   - Retornar top 10 chunks
4. Busca por keywords:
   - Aplicar expansao de sinonimos
   - Calcular score por keywords
   - Retornar top 10 chunks
5. Combinar resultados:
   - Reciprocal Rank Fusion (RRF)
   - Deduplicate por document_id
   - Retornar top 12 chunks finais
```

---

## Fase 5: Interface de Chat

### Arquivo: `src/pages/Chat.tsx`

### Funcionalidades

1. **Streaming Real**
   - Tokens aparecem caractere por caractere
   - Indicador de cursor piscando
   - Scroll automatico para ultima mensagem

2. **Indicador de "Pensando"**
   - Animacao durante processamento
   - Exibe etapas: "Analisando...", "Buscando..."
   - Accordion expansivel com detalhes

3. **Historico em localStorage**
   - Conversa persiste ao recarregar pagina
   - Limpa ao fechar navegador
   - Botao "Nova Conversa" para resetar

4. **Citacoes de Fontes**
   - Fontes locais com icone de documento
   - Fontes web com icone de link externo
   - Clique para expandir detalhes

### Componentes

**ChatMessage.tsx**
- Renderiza mensagens com Markdown
- Avatar diferente para usuario e CLARA
- Timestamp opcional
- Animacao de entrada

**ChatInput.tsx**
- Textarea auto-expansivel
- Envio com Enter (Shift+Enter para nova linha)
- Botao de enviar com loading state
- Desabilitado durante streaming

**ThinkingIndicator.tsx**
- Animacao de "dots" pulsando
- Texto da etapa atual
- Accordion para mostrar detalhes do thinking

**SourceCitation.tsx**
- Lista de fontes citadas
- Icones diferentes para local vs web
- Links clicaveis para fontes web
- Tooltips com mais informacoes

### Design Visual

Seguira o design system existente:
- Background: `--background` (deep navy)
- Cards: classe `glass-card` (glassmorphism)
- Botoes: `btn-clara-primary`, `btn-clara-secondary`
- Inputs: `search-input-clara`
- Cores: `--primary` (amber), `--muted-foreground`
- Animacoes: `animate-fade-in`, `animate-slide-up`

---

## Fase 6: Interface Admin

### Arquivo: `src/pages/Admin.tsx`

### Funcionalidades

1. **Lista de Documentos**
   - Tabela com nome, categoria, data
   - Status de processamento
   - Contagem de chunks

2. **Upload de Arquivos**
   - Drag and drop moderno
   - Suporte a PDF, DOCX, TXT
   - Barra de progresso
   - Preview do arquivo

3. **Gerenciamento**
   - Botao de remover documento
   - Confirmacao antes de deletar
   - Reprocessar documento

### Protecao

- Campo de senha no topo da pagina
- Valida contra ADMIN_KEY
- Estado salvo em sessionStorage

---

## Fase 7: Integracao

### Rotas no App.tsx

```typescript
<Route path="/chat" element={<Chat />} />
<Route path="/admin" element={<Admin />} />
```

### Conexao com HeroSection

O botao "Iniciar conversa" navegara para `/chat`:
- Adicionar apenas a navegacao (Link do react-router)
- NAO alterar visual ou estrutura do componente

A barra de busca enviara a query para o chat:
- Navegar para `/chat?q=termo+buscado`
- Chat le a query da URL e envia automaticamente

---

## Secrets Necessarios

| Nome | Descricao | Como obter |
|------|-----------|------------|
| GEMINI_API_KEY | Sua chave da API Google AI Studio | console.cloud.google.com |
| ADMIN_KEY | Senha para pagina admin | Voce define |

Vou solicitar estes secrets usando a ferramenta apropriada durante a implementacao.

---

## Migracao da Base de Conhecimento

Apos implementar o sistema, farei upload dos 4 documentos originais:

1. `manual_sei_4_content.txt` -> "Manual do Usuario SEI 4.0"
2. `cartilha_sei_content.txt` -> "Cartilha SEI"
3. `pdf_content.txt` -> "Manual de Prestacao de Contas SDP - 4a CRE"
4. `ErrosnoSEI-RJCancelamentoeCorreção.docx` -> "Guia de Erros no SEI-RJ"

---

## Elementos Preservados do Codigo Original

| Componente | Origem no GitHub | Status |
|------------|------------------|--------|
| System Prompt CLARA | `server/rag.ts:22-178` | 100% preservado |
| Mapa de sinonimos | `server/rag.ts:185-247` | 100% preservado |
| Classificador de intencao | `server/rag.ts:249-275` | 100% preservado |
| Algoritmo de scoring | `server/rag.ts:432-476` | 100% preservado |
| Mapeamento de titulos | `server/rag.ts:402-412` | 100% preservado |
| Search Grounding | `server/_core/llm.ts` | Nativo do Gemini |
| Thinking mode | `server/_core/llm.ts:380-386` | 100% preservado |
| Chunk size 4000 | Config RAG | 100% preservado |

---

## Melhorias Implementadas

| Melhoria | Descricao |
|----------|-----------|
| Streaming real | Tokens aparecem caractere por caractere via SSE |
| Busca semantica | pgvector para similaridade vetorial (alem de keywords) |
| Historico local | Conversa persiste no localStorage ate fechar navegador |
| Indicador pensando | Animacao e etapas do thinking mode do Gemini 3 |
| Search Grounding nativo | Busca web integrada ao Gemini (sua chave) |
| Upload drag and drop | Interface moderna para adicionar documentos |

---

## O Que NAO Sera Implementado

- Autenticacao/login de usuarios
- Persistencia de historico de conversas no servidor
- Banco de usuarios/profiles
- Sessoes salvas entre dispositivos

---

## Ordem de Execucao

1. Habilitar extensao pgvector no banco
2. Criar tabela `documents`
3. Criar tabela `document_chunks` com coluna vector
4. Criar bucket `knowledge-base` no Storage
5. Configurar RLS (leitura publica, escrita com admin)
6. Solicitar secret GEMINI_API_KEY
7. Solicitar secret ADMIN_KEY
8. Implementar Edge Function `clara-chat/`
9. Implementar Edge Function `documents/`
10. Implementar Edge Function `search/`
11. Criar componentes de chat
12. Criar pagina Chat.tsx
13. Criar pagina Admin.tsx
14. Adicionar rotas no App.tsx
15. Conectar botao HeroSection (apenas navegacao)
16. Conectar barra de busca (apenas navegacao)
17. Testar fluxo completo
18. Upload dos 4 documentos originais

---

## Secao Tecnica

### Adaptacoes de Codigo

**De Node.js/Express para Deno/Edge Functions:**
- tRPC removido (chamadas HTTP diretas)
- Drizzle ORM substituido por Supabase Client
- MySQL substituido por PostgreSQL
- Imports adaptados para Deno

**Geracao de Embeddings:**
- Usaremos a API de embeddings do Gemini
- Modelo: text-embedding-004 (768 dimensoes)
- Chamada direta via sua GEMINI_API_KEY

**Extracao de Texto:**
- PDF: biblioteca pdf-parse compativel com Deno
- DOCX: biblioteca mammoth adaptada para Deno
- TXT: leitura direta UTF-8

### Estrutura de Arquivos Final

```text
src/
  pages/
    Index.tsx          (INTOCADO)
    Chat.tsx           (NOVO)
    Admin.tsx          (NOVO)
    NotFound.tsx       (INTOCADO)
  components/
    Header.tsx         (INTOCADO)
    HeroSection.tsx    (INTOCADO - apenas Link adicionado)
    FeaturesSection.tsx (INTOCADO)
    Footer.tsx         (INTOCADO)
    chat/
      ChatMessage.tsx     (NOVO)
      ChatInput.tsx       (NOVO)
      ThinkingIndicator.tsx (NOVO)
      SourceCitation.tsx  (NOVO)
  hooks/
    useChat.ts         (NOVO - logica de streaming)
    useLocalStorage.ts (NOVO - persistencia)

supabase/
  functions/
    clara-chat/
      index.ts         (Core RAG + Gemini)
    documents/
      index.ts         (Upload + processamento)
    search/
      index.ts         (Busca hibrida)
  config.toml          (INTOCADO - auto-gerenciado)
```

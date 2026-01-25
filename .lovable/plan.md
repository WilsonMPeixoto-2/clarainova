
# Plano de Implementacao: 4 Funcionalidades + Sistema de Monitoramento

## Visao Geral

Este plano implementa as 4 funcionalidades gratuitas solicitadas, uma por vez, com foco em seguranca de recursos e sustentabilidade de custos. Todas utilizam tecnologias ja instaladas (recharts, jsPDF) e o tier gratuito do backend.

---

## Fase 1: Grafico Temporal de Analytics

**Objetivo:** Adicionar um grafico de linha mostrando a tendencia de feedbacks positivos vs negativos ao longo do tempo.

### Arquivos a Modificar:
- `src/components/admin/AnalyticsTab.tsx`

### Detalhes Tecnicos:
1. Importar componentes do recharts (LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend)
2. Criar funcao `useMemo` para agrupar feedbacks por dia:
   - Mapear feedbacks por data (formato DD/MM)
   - Contar positivos e negativos por dia
   - Gerar array de objetos: `{ date, positive, negative }`
3. Renderizar grafico entre as metricas e os dois cards existentes
4. Cores: verde (#22c55e) para positivos, vermelho (#ef4444) para negativos
5. Tooltip mostrando valores ao passar o mouse

### Interface Visual:
```text
+------------------------------------------+
|  [Card Metricas - 4 colunas]             |
+------------------------------------------+
|  Tendencia de Feedbacks (ultimos 30 dias)|
|  +--------------------------------------+|
|  |  [Grafico de Linha]                  ||
|  |  --- Positivos (verde)               ||
|  |  --- Negativos (vermelho)            ||
|  +--------------------------------------+|
+------------------------------------------+
|  [Top Topics]     [Feedbacks Negativos]  |
+------------------------------------------+
```

---

## Fase 2: Incluir Fontes no PDF

**Objetivo:** Adicionar uma secao "Fontes Consultadas" no PDF gerado, listando os documentos que a CLARA utilizou para responder.

### Arquivos a Modificar:
- `src/components/chat/DownloadPdfButton.tsx` (adicionar prop `sources`)
- `src/components/chat/ChatMessage.tsx` (passar `sources` para o botao)

### Detalhes Tecnicos:
1. Atualizar interface `DownloadPdfButtonProps`:
   ```typescript
   sources?: { local: string[]; web?: string[] };
   ```
2. Apos a secao "Resposta:", adicionar secao "Fontes Consultadas:" se houver fontes
3. Listar cada fonte local com icone de documento (simulado com bullet)
4. Listar fontes web como URLs clicaveis (texto formatado)
5. Manter paginacao funcionando corretamente

### Layout do PDF:
```text
+---------------------------------+
| CLARA - Inteligencia Admin.     |
| Gerado em: DD/MM/AAAA HH:MM     |
+---------------------------------+
| Sua pergunta:                   |
| "Texto da pergunta..."          |
|                                 |
| Resposta:                       |
| Texto da resposta...            |
|                                 |
| Fontes Consultadas:             |
| - Manual_SEI_v2.pdf             |
| - Decreto_1234.pdf              |
+---------------------------------+
```

---

## Fase 3: Historico de Conversas Persistente + Monitoramento

**Objetivo:** Salvar conversas de usuarios autenticados no banco de dados com monitoramento de uso e limpeza automatica a cada 3 meses.

### Parte A: Historico Persistente

#### Arquivos a Criar:
- `src/hooks/useChatSessions.ts` (gerenciamento de sessoes)
- `src/components/chat/ChatHistory.tsx` (lista de conversas anteriores)

#### Arquivos a Modificar:
- `src/hooks/useChat.ts` (integrar com banco de dados quando usuario logado)
- `src/components/chat/ChatPanel.tsx` (adicionar acesso ao historico)

#### Logica:
1. Se usuario **nao logado**: manter comportamento atual (localStorage)
2. Se usuario **logado**:
   - Criar nova sessao no banco ao iniciar conversa
   - Atualizar sessao a cada nova mensagem
   - Carregar sessoes anteriores do banco
   - Permitir alternar entre sessoes

### Parte B: Monitoramento de Uso (Admin)

#### Arquivos a Criar:
- `src/components/admin/StorageMonitor.tsx` (widget de uso)

#### Arquivos a Modificar:
- `src/components/admin/AnalyticsTab.tsx` (adicionar widget)

#### Metricas Monitoradas:
- Total de sessoes de chat armazenadas
- Tamanho estimado (contagem de caracteres em JSONB * fator)
- Percentual do limite (500MB = 100%)
- Alertas visuais em: 20%, 40%, 60%, 80%, 100%

### Parte C: Limpeza Automatica (Trimestral)

#### Banco de Dados:
1. Criar funcao SQL `cleanup_old_chat_sessions()`:
   - Deletar sessoes com `updated_at < NOW() - INTERVAL '90 days'`
   - Retornar quantidade de registros removidos
2. Criar cron job via pg_cron (ou funcao chamada manualmente pelo admin)

#### Interface Admin:
- Botao "Limpar Historicos Antigos" com confirmacao
- Mostra preview de quantos registros serao deletados

### Interface Visual (ChatPanel):
```text
+----------------------------------+
| CLARA                    [H] [X] |  <-- H = Historico
+----------------------------------+
| [Sheet lateral com lista de      |
|  conversas anteriores]           |
|                                  |
| > "Como criar processo SEI"      |
|   15/01/2026                     |
|                                  |
| > "Diarias de viagem"            |
|   12/01/2026                     |
+----------------------------------+
```

### Interface Visual (Admin - Monitoramento):
```text
+------------------------------------------+
| USO DE RECURSOS               [Limpar]   |
+------------------------------------------+
| Chat Sessions: 234 conversas             |
| Armazenamento: ~2.3 MB (0.46% de 500MB)  |
|                                          |
| [========                         ] 20%  |
| Status: Saudavel                         |
+------------------------------------------+
```

---

## Fase 4: Session Fingerprint para Analytics

**Objetivo:** Agrupar consultas da mesma sessao de navegacao para permitir ver o contexto completo ao analisar feedbacks negativos.

### Banco de Dados:
1. Adicionar coluna `session_fingerprint TEXT` na tabela `query_analytics`
2. Criar indice para busca rapida

### Arquivos a Modificar:
- `src/hooks/useChat.ts` (gerar e enviar fingerprint)
- `src/components/admin/FeedbackDetailModal.tsx` (mostrar historico da sessao)
- `src/components/admin/AnalyticsTab.tsx` (buscar sessao relacionada)

### Logica do Fingerprint:
1. Gerar ID unico por sessao de navegacao (sessionStorage)
2. Enviar fingerprint junto com cada query
3. No modal de feedback negativo, buscar todas as queries com mesmo fingerprint
4. Exibir contexto completo da conversa

### Interface Visual (Modal de Feedback):
```text
+------------------------------------------+
| Detalhes do Feedback                     |
+------------------------------------------+
| Pergunta: "Como anexar no SEI?"          |
| Resposta: "Para anexar..."               |
| Categoria: Incompleto                    |
| Comentario: "Faltou explicar X"          |
+------------------------------------------+
| CONTEXTO DA SESSAO (3 mensagens antes):  |
| 1. "O que e SEI?" -> "O SEI e..."        |
| 2. "Como criar processo?" -> "Para..."   |
| 3. "Como anexar no SEI?" <- ESTA         |
+------------------------------------------+
```

---

## Sistema de Alertas de Uso

### Niveis de Alerta:
| % do Limite | Cor     | Mensagem                              |
|-------------|---------|---------------------------------------|
| 0-20%       | Verde   | Uso normal                            |
| 20-40%      | Verde   | Uso moderado                          |
| 40-60%      | Amarelo | Atencao: considere limpeza            |
| 60-80%      | Laranja | Alerta: limpeza recomendada           |
| 80-100%     | Vermelho| Critico: limpeza necessaria           |

### Onde os Alertas Aparecem:
- Badge no cabecalho da aba Analytics
- Widget de monitoramento com barra de progresso
- Toast ao carregar Admin se > 60%

---

## Ordem de Implementacao

| Fase | Funcionalidade              | Complexidade | Tempo Estimado |
|------|-----------------------------|--------------|----------------|
| 1    | Grafico Temporal            | Baixa        | 1 iteracao     |
| 2    | Fontes no PDF               | Baixa        | 1 iteracao     |
| 3    | Historico + Monitoramento   | Alta         | 2-3 iteracoes  |
| 4    | Session Fingerprint         | Media        | 1-2 iteracoes  |

---

## Secao Tecnica

### Migracao SQL (Fase 3 - Limpeza):
```sql
-- Funcao para limpar sessoes antigas
CREATE OR REPLACE FUNCTION cleanup_old_chat_sessions(days_old INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM chat_sessions
  WHERE updated_at < NOW() - (days_old || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
```

### Migracao SQL (Fase 4 - Fingerprint):
```sql
-- Adicionar coluna de fingerprint
ALTER TABLE query_analytics
ADD COLUMN session_fingerprint TEXT;

-- Criar indice para busca
CREATE INDEX idx_query_analytics_session_fingerprint
ON query_analytics(session_fingerprint);
```

### Calculo de Armazenamento Estimado:
```typescript
// 1 char = 1 byte (simplificado)
// JSONB overhead ~20%
const estimateSizeBytes = (sessions: ChatSession[]) => {
  const totalChars = sessions.reduce((acc, s) => 
    acc + JSON.stringify(s.messages).length, 0
  );
  return Math.round(totalChars * 1.2); // 20% overhead
};

const percentUsed = (bytes: number) => 
  ((bytes / (500 * 1024 * 1024)) * 100).toFixed(2);
```

---

## Resumo de Custos

| Recurso            | Uso Atual | Limite Gratuito | Projecao |
|--------------------|-----------|-----------------|----------|
| Database           | ~1 MB     | 500 MB          | <5 MB/ano|
| Edge Functions     | ~100/dia  | 500.000/mes     | OK       |
| Storage            | ~10 MB    | 1 GB            | OK       |

**Conclusao:** Todas as funcionalidades operam dentro do tier gratuito com ampla margem de seguranca. A limpeza trimestral garante sustentabilidade a longo prazo.

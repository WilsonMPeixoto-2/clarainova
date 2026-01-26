import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Model configuration based on response mode
const MODEL_MAP: Record<string, { model: string; temperature: number; max_tokens: number }> = {
  "fast": { model: "google/gemini-3-flash-preview", temperature: 0.5, max_tokens: 4096 },
  "deep": { model: "google/gemini-3-pro-preview", temperature: 0.3, max_tokens: 8192 },
};

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  maxRequests: 15, // 15 requests per window
  windowSeconds: 60, // 1 minute window
};

// Helper to get client identifier for rate limiting
function getClientKey(req: Request): string {
  // Try multiple headers for client identification
  const forwarded = req.headers.get("x-forwarded-for");
  const cfIp = req.headers.get("cf-connecting-ip");
  const realIp = req.headers.get("x-real-ip");
  
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  if (cfIp) return cfIp;
  if (realIp) return realIp;
  
  return "unknown";
}

// =============================================
// SYSTEM PROMPT COMPLETO DA CLARA
// =============================================

// Obtém a data atual para contexto temporal (Prazos, Vigência)
const currentDate = new Date().toLocaleDateString('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

const CLARA_SYSTEM_PROMPT = `Você é a **CLARA** (Consultora de Legislação e Apoio a Rotinas Administrativas).
Sua missão é atuar como uma "colega sênior" experiente, paciente e pedagógica.
Data atual: ${currentDate}.
Prioridade absoluta: resolver a dúvida do usuário com resultado operacional.
Isso significa responder: O que fazer agora + Por quê + Qual o risco se fizer errado.

## Empatia Cognitiva

**Frases de acolhimento (use NO MÁXIMO 1 por resposta, escolha a mais adequada):**
- "Entendo sua dúvida — isso é mais comum do que parece."
- "Fique tranquilo: vou te guiar em passos curtos."
- "Vamos simplificar: primeiro o essencial, depois os detalhes."
- "Se algo não aparecer na sua tela, me diga o que você está vendo que eu ajusto o caminho."

**Regras de empatia:**
1. **Acolha sem exagero:** Uma frase breve de contexto. Nunca mais de uma linha.
2. **Explique o PORQUÊ:** Em procedimentos, sempre inclua 1 linha explicando por que o passo é necessário.
   - ❌ Comando frio: "Clique em Concluir."
   - ✅ Comando com contexto: "Clique em **Concluir** para sinalizar ao sistema que a etapa acabou e liberar o processo para tramitação."
3. **Analogias Didáticas:** Se o conceito for abstrato (como Empenho, Blocos de Assinatura, RPA), use uma metáfora do mundo físico (pastas, carimbos, gavetas) antes da explicação técnica. Limite a 2 frases.
   - Exemplo: "Pense no empenho como 'reservar o dinheiro no cofre' antes de pagar. Sem ele, o sistema trava."
4. **Antecipe a Ansiedade:** Se o procedimento for longo, avise: "São X etapas, mas vou te acompanhar em cada uma."
5. **Antecipe o erro comum:** Se houver uma "pegadinha" conhecida, alerte uma vez, de forma direta.

## Inteligência Terminológica

Usuários frequentemente usam termos incorretos, sinônimos ou vocabulário de outros sistemas (ex: Processo.Rio). Sua obrigação é **interpretar a intenção, não travar na palavra-chave**.

**Estratégias obrigatórias:**
1. **Inferência por contexto:** Se a pergunta fizer sentido no contexto administrativo, assuma que o usuário usou um sinônimo e responda normalmente.
   - Exemplo: "tramitar processo" → entenda como "enviar processo"
   - Exemplo: "validar PDF" → entenda como "autenticar documento"
   - Exemplo: "aprovar documento" → pode ser "assinar" ou "autenticar"
2. **Confirmação suave:** Se houver ambiguidade, confirme antes de responder:
   - "Você quer dizer **enviar** o processo para outra unidade? Se for isso, o passo é..."
   - "Quando você fala em 'validar', está se referindo a **autenticar** o documento? Me confirma que eu explico."
3. **Pedido de esclarecimento gentil:** Se não conseguir inferir, peça mais contexto:
   - "Me ajuda a entender melhor: você pode dar um exemplo do que está tentando fazer?"
   - "Não identifiquei exatamente o que você precisa. Pode descrever o passo em que está travado?"
4. **Nunca diga "não entendi":** Sempre ofereça um caminho. Se a pergunta foi coerente, o problema pode ser terminológico.

**Equivalências comuns (memorize):**
- Tramitar / Movimentar / Passar → **Enviar** (SEI)
- Validar / Confirmar / Aprovar → **Assinar** ou **Autenticar**
- Arquivar / Guardar / Fechar → **Concluir** ou **Arquivar**
- Anexar / Juntar / Colocar → **Incluir Documento**
- Cancelar / Excluir / Apagar → **Excluir** ou **Anular**

## Tom Anti-Robô

- **Evite frases burocráticas:** "Conforme consta no documento...", "De acordo com a legislação vigente...", "Cumpre informar que..."
- **Prefira impacto prático:** "Para resolver isso, o procedimento é..." ou "Na prática, você precisa..."
- **Fale como colega, não como manual:** Imagine que está explicando para alguém na mesa ao lado.

## Formatação Visual

- Use **negrito** para botões, telas e sistemas (ex: **SEI!Rio**, botão **Incluir Documento**).
- Use \`código\` para campos e menus do sistema (ex: menu \`Processo\` > \`Incluir\`).
- Use listas numeradas para procedimentos sequenciais.
- **Emojis:** Use APENAS estes, no máximo 1 por seção, e apenas quando acrescentar utilidade real:
  - 💡 Para dica de ouro ou atalho útil
  - ⚠️ Para alerta crítico, prazo fatal ou risco de erro
  - ✅ Para confirmação de etapa concluída
  - 📄 Para referência a documento específico

## Escopo de Atuação (REGRA INEGOCIÁVEL)

Você SOMENTE responde perguntas sobre:

**1. Sistemas SEI (SEI!Rio e SEI Federal)**
- Criação, tramitação e arquivamento de processos
- Inclusão, edição e assinatura de documentos
- Blocos de assinatura (internos e externos)
- Níveis de acesso, permissões e credenciamento
- Pesquisa, localização e acompanhamento de processos
- Erros operacionais do sistema e suas soluções

**2. Procedimentos Administrativos Formais**
- Prestação de contas de verbas (PDDE, FNDE, verbas municipais)
- Formalização de ações (dispensas, inexigibilidades, contratos)
- Documentos necessários para cada tipo de procedimento
- Fluxos e trâmites entre setores e órgãos

**3. Legislação e Normas Vigentes**
- Decretos, portarias, resoluções e instruções normativas
- Consultas do tipo "qual decreto regula X?"
- Prazos legais, obrigações e penalidades
- Orientações de órgãos de controle (CGM, TCM, CGU)

## Tratamento de Perguntas Fora do Escopo (RIGIDEZ OBRIGATÓRIA)

⚠️ **VOCÊ NÃO É UM CHATGPT GENÉRICO.** Se a pergunta não se enquadrar nos 3 eixos acima, recuse de forma elegante, educada, mas FIRME.

**Modelo de Recusa (use variações naturais):**
"Meu foco exclusivo é apoiar rotinas administrativas, uso de sistemas como SEI e Processo.Rio, e questões de legislação e normas. Infelizmente, não posso ajudar com esse assunto. Se você tiver alguma dúvida dentro desse escopo, estou à disposição!"

**Alternativa com conversão:**
"Essa pergunta está fora da minha área de atuação. Sou especializada em:
- Sistemas administrativos (SEI, Processo.Rio)
- Procedimentos formais e rotinas de trabalho
- Legislação e normas aplicáveis

Se sua dúvida se relacionar a algum desses temas, ficarei feliz em ajudar!"

**Lista de exclusão explícita (NUNCA responda, sem exceções):**
- Assuntos pessoais (saúde, dietas, receitas, relacionamentos, finanças pessoais)
- Esportes, entretenimento, filmes, música, cultura geral
- Opinião política, partidária ou ideológica
- Suporte de TI genérico (rede, hardware, software, impressoras)
- Interpretação jurídica de casos concretos (isso é papel de advogado)
- Conselhos de vida, coaching, motivação
- Qualquer pergunta que não tenha relação com trabalho administrativo público

**Postura:** Seja gentil na forma, mas inabalável no conteúdo. Não ceda a insistências.

## Política de Zero Dados Pessoais (REGRA DE SEGURANÇA INEGOCIÁVEL)

⚠️ **VOCÊ NÃO ACEITA DADOS PESSOAIS EM NENHUMA HIPÓTESE.**

Se o usuário incluir na pergunta qualquer dado pessoal (próprio ou de terceiros), você DEVE:

1. **Interromper imediatamente** a resposta sobre o tema.
2. **Solicitar reformulação** sem os dados pessoais.
3. **Explicar a política** de forma breve e firme.

**Dados pessoais incluem (mas não se limitam a):**
- CPF, RG, matrícula funcional, número de processo com dados identificáveis
- Endereço, telefone, e-mail pessoal
- Nome completo (exceto primeiro nome do próprio usuário)
- Dados de saúde, dados financeiros, dados familiares
- Qualquer informação que identifique uma pessoa específica

**Modelo de resposta para dados pessoais detectados:**
"Notei que sua pergunta contém dados pessoais. Por política de segurança, a CLARA opera com **acesso zero a informações pessoais** — isso protege você e qualquer pessoa mencionada. 

Por favor, reformule sua pergunta removendo esses dados. Por exemplo, em vez de 'O processo 123.456 do João da Silva...', use 'Um processo de [tipo]...'. 

Assim posso te ajudar com segurança!"

**Postura:** Não processe a pergunta original. Não repita os dados na resposta. Apenas peça a reformulação.

## Protocolo de Resposta

1. **Perguntas específicas:** Resposta direta + passo a passo numerado + fonte.

2. **Perguntas amplas ("Como uso o SEI?", "Me explica tudo sobre X"):** Forneça um **mapa de navegação** com estrutura fixa:
   
   **5 tópicos essenciais sobre [tema]:**
   1. [Tópico 1 - o mais básico]
   2. [Tópico 2]
   3. [Tópico 3]
   4. [Tópico 4]
   5. [Tópico 5 - o mais avançado]
   
   **Para refinar sua dúvida, me diga:**
   - [Pergunta de refinamento 1]
   - [Pergunta de refinamento 2]
   - [Pergunta de refinamento 3]
   
   💡 Sugiro começar pelo básico: [indicação do tópico 1].
   
   Não dê palestras. Guie o usuário para perguntas específicas.

3. **Lacunas de informação (template obrigatório):**
   Quando não encontrar a informação completa, use esta estrutura:
   
   **O que encontrei:** [resumo do que a base de conhecimento tem sobre o tema]
   
   **O que não localizei:** [especifique o que está faltando - prazo? decreto? procedimento?]
   
   **Onde você pode confirmar:** [D.O. Rio, portal da CGM, TCM, ou setor específico]
   
   **Se você me informar [X], consigo orientar melhor:** [peça dado específico que ajudaria]
   
   ⚠️ NÃO INVENTE. Proibido alucinar leis, prazos ou procedimentos.

4. **Sistemas distintos:** Diferencie SEI Federal vs SEI!Rio vs Processo.rio. Se a pergunta for ambígua, peça esclarecimento.

## Citação de Fontes (OBRIGATÓRIO)

**Regra de Ouro:** Toda informação deve ter fonte citada. Sem exceções.

**Formato de citação:**
- Base local: [Manual SEI 4.0, p. X] ou [Nome do Documento]
- Legislação: Decreto nº X/YYYY, Lei nº X/YYYY, Resolução X
- Web: Link completo + título da página

**Exemplo de citação completa:**
"O prazo para recurso é de 10 dias úteis (Decreto nº 51.628/2022, Art. 5º)."

## Busca na Web - Fontes Confiáveis

Quando buscar informações na web, priorize estas fontes oficiais:

**Domínios confiáveis (lista não exaustiva):**
- *.prefeitura.rio (procuradoria, controladoria, educacao, saude, etc.)
- leismunicipais.com.br (legislação municipal consolidada)
- *.gov.br (sites federais, estaduais)
- diariodoamanha.rio (Diário Oficial do Rio)
- tcm.rj.gov.br (Tribunal de Contas do Município)
- camara.rj.gov.br (Câmara Municipal)

**Fontes específicas recomendadas:**
- https://procuradoria.prefeitura.rio - PGM Rio (pareceres, orientações jurídicas)
- https://controladoria.prefeitura.rio - CGM Rio (manuais, guias, normas internas)
- https://leismunicipais.com.br/rj/rio-de-janeiro - Decretos e leis municipais
- Portais das secretarias municipais (educacao, saude, fazenda, etc.)

**Flexibilidade com responsabilidade:**
- Não se limite a domínios .gov.br ou .org.br
- Secretarias e órgãos municipais usam subdomínios de prefeitura.rio
- leismunicipais.com.br é fonte confiável para legislação consolidada
- O importante é que seja fonte oficial ou amplamente reconhecida

## Disclaimer para Respostas com Busca Web (OBRIGATÓRIO)

⚠️ Sempre que a resposta incluir informações obtidas via busca na internet, adicione este aviso ao final:

**Modelo de disclaimer:**
"---
📌 **Nota importante:** Esta resposta foi elaborada com base em busca na internet. Recomendo confirmar a vigência atual e possíveis alterações da legislação/norma citada diretamente na fonte oficial. Legislações podem sofrer revogações, alterações ou regulamentações posteriores."

**Quando usar o disclaimer:**
- Sempre que citar decretos, leis ou resoluções encontrados via web
- Quando referenciar manuais ou guias que podem ter versões atualizadas
- Quando a informação não vier da base de conhecimento local

**Quando NÃO precisa do disclaimer:**
- Informações da base local (documentos já validados)
- Procedimentos operacionais básicos do SEI que não mudam
- Orientações gerais que não dependem de legislação específica`;

// =============================================
// MAPA DE SINÔNIMOS
// Preservado 100% do original server/rag.ts
// =============================================
const SYNONYM_MAP: Record<string, string[]> = {
  "abrir": ["iniciar", "criar", "gerar", "cadastrar", "autuar", "instaurar"],
  "anexar": ["incluir", "adicionar", "inserir", "juntar", "acostar"],
  "processo": ["procedimento", "expediente", "autos", "documento", "protocolo"],
  "documento": ["arquivo", "peça", "ofício", "memorando", "despacho"],
  "assinar": ["rubricar", "autenticar", "validar", "firmar"],
  "enviar": ["tramitar", "encaminhar", "remeter", "despachar", "expedir"],
  "receber": ["acolher", "recepcionar", "dar entrada"],
  "cancelar": ["anular", "revogar", "invalidar", "desfazer", "estornar"],
  "editar": ["modificar", "alterar", "corrigir", "retificar", "atualizar"],
  "excluir": ["deletar", "remover", "apagar", "eliminar"],
  "buscar": ["pesquisar", "procurar", "localizar", "encontrar", "consultar"],
  "bloco": ["conjunto", "grupo", "lote", "pacote"],
  "unidade": ["setor", "órgão", "departamento", "coordenadoria", "gerência"],
  "usuário": ["servidor", "funcionário", "colaborador", "operador"],
  "permissão": ["acesso", "perfil", "credencial", "autorização", "habilitação"],
  "erro": ["problema", "falha", "bug", "inconsistência", "defeito"],
  "login": ["acesso", "autenticação", "entrada", "logon"],
  "senha": ["password", "credencial", "código de acesso"],
  "prestação de contas": ["PC", "relatório financeiro", "demonstrativo"],
  "despesa": ["gasto", "custo", "pagamento", "desembolso"],
  "verba": ["recurso", "dotação", "crédito", "orçamento"],
  "planilha": ["tabela", "demonstrativo", "quadro", "mapa"],
  "conferir": ["verificar", "checar", "validar", "auditar"],
  "aprovar": ["deferir", "autorizar", "homologar", "sancionar"],
  "reprovar": ["indeferir", "recusar", "rejeitar", "negar"],
  "pendência": ["pendente", "aguardando", "em aberto"],
  "concluir": ["finalizar", "encerrar", "terminar", "arquivar"],
  "modelo": ["template", "padrão", "minuta", "formulário"]
};

// =============================================
// CLASSIFICADOR DE INTENÇÃO
// Preservado do original
// =============================================
interface IntentClassification {
  intent: string;
  confidence: number;
  keywords: string[];
}

function classifyIntent(query: string): IntentClassification {
  const normalizedQuery = query.toLowerCase();
  
  const intents = [
    { intent: "CREATE_PROCESS", patterns: ["criar processo", "abrir processo", "iniciar processo", "novo processo", "autuar"], keywords: ["criar", "abrir", "iniciar", "novo", "autuar"] },
    { intent: "ADD_DOCUMENT", patterns: ["anexar documento", "incluir documento", "adicionar arquivo", "upload"], keywords: ["anexar", "incluir", "adicionar", "upload", "documento"] },
    { intent: "SIGN_DOCUMENT", patterns: ["assinar documento", "assinatura", "rubricar", "validar documento"], keywords: ["assinar", "assinatura", "rubricar", "validar"] },
    { intent: "SEND_PROCESS", patterns: ["enviar processo", "tramitar", "encaminhar", "remeter"], keywords: ["enviar", "tramitar", "encaminhar", "remeter"] },
    { intent: "SEARCH", patterns: ["buscar", "pesquisar", "localizar", "encontrar", "onde fica"], keywords: ["buscar", "pesquisar", "localizar", "encontrar", "onde"] },
    { intent: "ERROR_HELP", patterns: ["erro", "problema", "não consigo", "falha", "bug", "não funciona"], keywords: ["erro", "problema", "falha", "bug", "não consigo"] },
    { intent: "SDP_PRESTACAO", patterns: ["prestação de contas", "sdp", "despesa", "verba", "planilha"], keywords: ["prestação", "contas", "sdp", "despesa", "verba"] },
    { intent: "BLOCK_SIGNATURE", patterns: ["bloco de assinatura", "bloco interno", "bloco externo"], keywords: ["bloco", "assinatura"] },
    { intent: "GENERAL_INFO", patterns: ["o que é", "como funciona", "explicar", "definição"], keywords: ["o que", "como", "explicar", "definição"] }
  ];
  
  let bestMatch: IntentClassification = { intent: "GENERAL_INFO", confidence: 0.3, keywords: [] };
  
  for (const { intent, patterns, keywords } of intents) {
    for (const pattern of patterns) {
      if (normalizedQuery.includes(pattern)) {
        return { intent, confidence: 0.9, keywords };
      }
    }
    const matchedKeywords = keywords.filter(k => normalizedQuery.includes(k));
    if (matchedKeywords.length > bestMatch.keywords.length) {
      bestMatch = { intent, confidence: 0.5 + (matchedKeywords.length * 0.1), keywords: matchedKeywords };
    }
  }
  
  return bestMatch;
}

// =============================================
// EXPANSÃO DE QUERY COM SINÔNIMOS
// =============================================
function expandQueryWithSynonyms(query: string): string[] {
  const words = query.toLowerCase().split(/\s+/);
  const expanded: Set<string> = new Set(words);
  
  for (const word of words) {
    // Adicionar sinônimos
    if (SYNONYM_MAP[word]) {
      SYNONYM_MAP[word].forEach(syn => expanded.add(syn));
    }
    // Verificar se a palavra é um sinônimo de algo
    for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
      if (synonyms.includes(word)) {
        expanded.add(key);
        synonyms.forEach(syn => expanded.add(syn));
      }
    }
  }
  
  return Array.from(expanded);
}

// =============================================
// ALGORITMO DE SCORING POR KEYWORDS
// Preservado do original server/rag.ts
// =============================================
function scoreChunkByKeywords(content: string, expandedTerms: string[], originalQuery: string): number {
  const normalizedContent = content.toLowerCase();
  const normalizedQuery = originalQuery.toLowerCase();
  let score = 0;
  
  // Match exato de frase: +15 pontos
  if (normalizedContent.includes(normalizedQuery)) {
    score += 15;
  }
  
  // Match de palavras individuais: +2 pontos cada
  for (const term of expandedTerms) {
    if (normalizedContent.includes(term)) {
      score += 2;
    }
  }
  
  // Termos SEI-específicos: +3 pontos
  const seiTerms = ["sei", "processo", "documento", "assinatura", "bloco", "tramitação", "unidade", "usuário"];
  for (const term of seiTerms) {
    if (normalizedQuery.includes(term) && normalizedContent.includes(term)) {
      score += 3;
    }
  }
  
  // Palavras de ação em queries "como": +2 pontos
  if (normalizedQuery.startsWith("como")) {
    const actionWords = ["clique", "selecione", "acesse", "abra", "digite", "escolha", "confirme"];
    for (const action of actionWords) {
      if (normalizedContent.includes(action)) {
        score += 2;
      }
    }
  }
  
  return score;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase client early for rate limiting
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Rate limiting check
    const clientKey = getClientKey(req);
    const { data: rateLimitResult, error: rateLimitError } = await supabase.rpc(
      "check_rate_limit",
      {
        p_client_key: clientKey,
        p_endpoint: "clara-chat",
        p_max_requests: RATE_LIMIT_CONFIG.maxRequests,
        p_window_seconds: RATE_LIMIT_CONFIG.windowSeconds,
      }
    );

    if (rateLimitError) {
      console.error("Rate limit check error:", rateLimitError);
      // Continue without rate limiting if there's an error
    } else if (rateLimitResult && rateLimitResult.length > 0 && !rateLimitResult[0].allowed) {
      const resetIn = rateLimitResult[0].reset_in || RATE_LIMIT_CONFIG.windowSeconds;
      return new Response(
        JSON.stringify({
          error: "Limite de requisições excedido. Por favor, aguarde um momento.",
          retryAfter: resetIn,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(resetIn),
          },
        }
      );
    }

    const { message, history = [], mode = "fast" } = await req.json();
    
    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Mensagem é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get API keys
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY não configurada");
    }
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    // Classificar intenção
    const intentClass = classifyIntent(message);
    
    // Expandir query com sinônimos
    const expandedTerms = expandQueryWithSynonyms(message);
    
    // Buscar chunks relevantes usando embeddings (still use Gemini for embeddings)
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
    
    // Gerar embedding da query
    const embeddingResult = await embeddingModel.embedContent(message);
    const queryEmbedding = embeddingResult.embedding.values;
    
    // Busca semântica via pgvector
    const { data: semanticChunks, error: searchError } = await supabase.rpc(
      "search_document_chunks",
      {
        query_embedding: JSON.stringify(queryEmbedding),
        match_threshold: 0.3,
        match_count: 10
      }
    );
    
    if (searchError) {
      console.error("Erro na busca semântica:", searchError);
    }
    
    // Busca por keywords em todos os chunks
    const { data: allChunks } = await supabase
      .from("document_chunks")
      .select("id, content, document_id, metadata");
    
    // Aplicar scoring por keywords
    const keywordScoredChunks = (allChunks || [])
      .map(chunk => ({
        ...chunk,
        keywordScore: scoreChunkByKeywords(chunk.content, expandedTerms, message)
      }))
      .filter(chunk => chunk.keywordScore > 0)
      .sort((a, b) => b.keywordScore - a.keywordScore)
      .slice(0, 10);
    
    // Combinar resultados (Reciprocal Rank Fusion)
    const chunkScores = new Map<string, { chunk: any; score: number }>();
    const k = 60; // Constante RRF
    
    // Adicionar scores da busca semântica
    (semanticChunks || []).forEach((chunk: any, index: number) => {
      const rrfScore = 1 / (k + index + 1);
      chunkScores.set(chunk.id, { chunk, score: rrfScore });
    });
    
    // Adicionar/combinar scores da busca por keywords
    keywordScoredChunks.forEach((chunk, index) => {
      const rrfScore = 1 / (k + index + 1);
      const existing = chunkScores.get(chunk.id);
      if (existing) {
        existing.score += rrfScore;
      } else {
        chunkScores.set(chunk.id, { chunk, score: rrfScore });
      }
    });
    
    // Ordenar e pegar top 12
    const finalChunks = Array.from(chunkScores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map(item => item.chunk);
    
    // Buscar títulos dos documentos
    const documentIds = [...new Set(finalChunks.map(c => c.document_id))];
    const { data: documents } = await supabase
      .from("documents")
      .select("id, title, category")
      .in("id", documentIds);
    
    const docMap = new Map(documents?.map(d => [d.id, d]) || []);
    
    // Montar contexto
    const contextParts = finalChunks.map(chunk => {
      const doc = docMap.get(chunk.document_id);
      const source = doc ? `[${doc.title}]` : "[Documento]";
      return `${source}\n${chunk.content}`;
    });
    
    const context = contextParts.join("\n\n---\n\n");
    
    // Preparar histórico de mensagens para Lovable AI Gateway (OpenAI format)
    const chatHistory = history.map((msg: { role: string; content: string }) => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content
    }));
    
    // Prompt do usuário com contexto
    const userPrompt = `## Contexto da Base de Conhecimento

${context || "Nenhum documento relevante encontrado na base de conhecimento."}

---

## Pergunta do Usuário

${message}

---

## Instruções

Responda à pergunta do usuário com base no contexto fornecido. Se o contexto não contiver informação suficiente, use seu conhecimento geral sobre o SEI e sistemas administrativos, mas indique claramente quando estiver fazendo isso.

Sempre cite as fontes quando usar informação do contexto [Nome do Documento].`;

    // Use Lovable AI Gateway for chat completion (OpenAI-compatible API)
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_MAP[mode]?.model || MODEL_MAP["fast"].model,
        messages: [
          { role: "system", content: CLARA_SYSTEM_PROMPT },
          ...chatHistory,
          { role: "user", content: userPrompt }
        ],
        stream: true,
        temperature: MODEL_MAP[mode]?.temperature || MODEL_MAP["fast"].temperature,
        max_tokens: MODEL_MAP[mode]?.max_tokens || MODEL_MAP["fast"].max_tokens,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições da IA excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Entre em contato com o administrador." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("Lovable AI Gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    // Coletar fontes locais
    const localSources = documents?.map(d => d.title) || [];
    
    // Create SSE stream that transforms OpenAI format to our format
    const encoder = new TextEncoder();
    const reader = response.body?.getReader();
    
    if (!reader) {
      throw new Error("No response body from AI gateway");
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Enviar evento de início
          controller.enqueue(encoder.encode(`event: thinking\ndata: ${JSON.stringify({ status: "searching", step: "Buscando na base de conhecimento..." })}\n\n`));
          
          const decoder = new TextDecoder();
          let buffer = "";
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            
            // Process line by line
            let newlineIndex: number;
            while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
              let line = buffer.slice(0, newlineIndex);
              buffer = buffer.slice(newlineIndex + 1);
              
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (line.startsWith(":") || line.trim() === "") continue;
              if (!line.startsWith("data: ")) continue;
              
              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") continue;
              
              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content as string | undefined;
                if (content) {
                  controller.enqueue(encoder.encode(`event: delta\ndata: ${JSON.stringify({ content })}\n\n`));
                }
              } catch {
                // Incomplete JSON, put it back and wait for more data
                buffer = line + "\n" + buffer;
                break;
              }
            }
          }
          
          // Final flush
          if (buffer.trim()) {
            for (let raw of buffer.split("\n")) {
              if (!raw) continue;
              if (raw.endsWith("\r")) raw = raw.slice(0, -1);
              if (raw.startsWith(":") || raw.trim() === "") continue;
              if (!raw.startsWith("data: ")) continue;
              const jsonStr = raw.slice(6).trim();
              if (jsonStr === "[DONE]") continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content as string | undefined;
                if (content) {
                  controller.enqueue(encoder.encode(`event: delta\ndata: ${JSON.stringify({ content })}\n\n`));
                }
              } catch { /* ignore partial leftovers */ }
            }
          }
          
          // Enviar fontes locais
          if (localSources.length > 0) {
            controller.enqueue(encoder.encode(`event: sources\ndata: ${JSON.stringify({ local: localSources })}\n\n`));
          }
          
          // Enviar evento de conclusão
          controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
          controller.close();
        } catch (error) {
          console.error("Erro no streaming:", error);
          const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: errorMessage })}\n\n`));
          controller.close();
        }
      }
    });
    
    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });
    
  } catch (error) {
    console.error("Erro na função clara-chat:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

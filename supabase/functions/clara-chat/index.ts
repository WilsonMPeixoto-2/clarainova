// Import map: ../import_map.json (used during Supabase deploy)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Model configuration based on response mode (Direct Gemini API models)
const MODEL_MAP: Record<string, { model: string; temperature: number; max_tokens: number }> = {
  "fast": { model: "gemini-2.0-flash", temperature: 0.5, max_tokens: 4096 },
  "deep": { model: "gemini-1.5-pro", temperature: 0.3, max_tokens: 8192 },
};

// Lovable AI Gateway model map (fallback when Gemini rate limits)
const LOVABLE_MODEL_MAP: Record<string, { model: string; temperature: number; max_tokens: number }> = {
  "fast": { model: "google/gemini-3-flash-preview", temperature: 0.5, max_tokens: 4096 },
  "deep": { model: "google/gemini-3-pro-preview", temperature: 0.3, max_tokens: 8192 },
};

// Web search grounding configuration
const WEB_SEARCH_CONFIG = {
  // Minimum chunks required to skip web search
  minChunksForLocalOnly: 3,
  // Minimum RRF score to consider local results sufficient
  minRRFScoreThreshold: 0.015,
  // Trusted domains for web search (will be prioritized)
  trustedDomains: [
    "prefeitura.rio",
    "leismunicipais.com.br",
    "gov.br",
    "tcm.rj.gov.br",
    "camara.rj.gov.br"
  ]
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

// Mode-specific instructions for Direto vs Didático
const MODE_INSTRUCTIONS: Record<string, string> = {
  "fast": `## Modo de Resposta: DIRETO
Você está no modo "Direto". Priorize:
- Respostas objetivas e concisas
- Bullets e listas numeradas
- Citações diretas das fontes
- Menos analogias, mais ação
- Formato: O quê fazer → Como fazer → Fonte`,

  "deep": `## Modo de Resposta: DIDÁTICO
Você está no modo "Didático". Priorize:
- Explicações completas com contexto
- Analogias do mundo físico antes de termos técnicos
- O "porquê" antes do "como"
- Exemplos práticos ilustrativos
- Antecipação de dúvidas correlatas`
};

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
    
    // Input validation - message
    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Mensagem é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Input validation - message length (max 10,000 characters)
    if (message.length > 10000) {
      return new Response(
        JSON.stringify({ error: "Mensagem muito longa. Máximo de 10.000 caracteres permitidos." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Input validation - history (max 50 messages)
    if (!Array.isArray(history)) {
      return new Response(
        JSON.stringify({ error: "Histórico deve ser um array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (history.length > 50) {
      return new Response(
        JSON.stringify({ error: "Histórico muito longo. Máximo de 50 mensagens permitidas." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Input validation - mode
    if (mode !== "fast" && mode !== "deep") {
      return new Response(
        JSON.stringify({ error: "Modo inválido. Use 'fast' ou 'deep'." }),
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
    const sortedChunks = Array.from(chunkScores.values())
      .sort((a, b) => b.score - a.score);
    
    const finalChunks = sortedChunks
      .slice(0, 12)
      .map(item => item.chunk);
    
    // Calculate average RRF score for top results to determine if web search is needed
    const topScores = sortedChunks.slice(0, 5).map(item => item.score);
    const avgTopScore = topScores.length > 0 
      ? topScores.reduce((a, b) => a + b, 0) / topScores.length 
      : 0;
    
    // Determine if we need web search fallback
    const needsWebSearch = 
      finalChunks.length < WEB_SEARCH_CONFIG.minChunksForLocalOnly ||
      avgTopScore < WEB_SEARCH_CONFIG.minRRFScoreThreshold;
    
    console.log(`[clara-chat] RAG results: ${finalChunks.length} chunks, avgScore: ${avgTopScore.toFixed(4)}, needsWebSearch: ${needsWebSearch}`);
    
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
    const webSearchInstruction = needsWebSearch 
      ? `\n\n## Instrução Adicional - Busca Web Ativada
      
A base local não contém informação suficiente sobre este tema. Use a ferramenta de busca do Google para encontrar informações atualizadas.
PRIORIZE fontes oficiais: ${WEB_SEARCH_CONFIG.trustedDomains.join(", ")}.
SEMPRE inclua o disclaimer de busca web ao final da resposta.
INICIE a resposta mencionando que consultou fontes externas.`
      : "";

    // Get mode-specific instruction
    const modeInstruction = MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS["fast"];

    const userPrompt = `${modeInstruction}

## Contexto da Base de Conhecimento

${context || "Nenhum documento relevante encontrado na base de conhecimento."}

---

## Pergunta do Usuário

${message}

---

## Instruções

Responda à pergunta do usuário com base no contexto fornecido. Se o contexto não contiver informação suficiente, use seu conhecimento geral sobre o SEI e sistemas administrativos, mas indique claramente quando estiver fazendo isso.

Sempre cite as fontes quando usar informação do contexto [Nome do Documento].${webSearchInstruction}`;

    // Use Google Generative AI SDK directly for chat completion (reuse genAI from embeddings)
    const modelConfig = MODEL_MAP[mode] || MODEL_MAP["fast"];
    
    // Create chat model with optional Google Search grounding
    // deno-lint-ignore no-explicit-any
    const modelOptions: any = {
      model: modelConfig.model,
      generationConfig: {
        temperature: modelConfig.temperature,
        maxOutputTokens: modelConfig.max_tokens,
      },
    };
    
    // Enable Google Search grounding when local RAG is insufficient
    if (needsWebSearch) {
      modelOptions.tools = [{ googleSearch: {} }];
      console.log("[clara-chat] Google Search grounding enabled for this request");
    }
    
    const chatModel = genAI.getGenerativeModel(modelOptions);

    // Build chat history for the SDK
    const contents = [
      ...chatHistory.map((msg: { role: string; content: string }) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      })),
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ];

    console.log(`[clara-chat] Using direct Gemini API with model: ${modelConfig.model}, webSearch: ${needsWebSearch}`);

    // Try Gemini API first, fallback to Lovable AI Gateway on 429
    let result: Awaited<ReturnType<typeof chatModel.generateContentStream>> | null = null;
    let useFallback = false;
    let apiProvider: "gemini" | "lovable" = "gemini";
    let activeModelName = modelConfig.model;
    
    try {
      result = await chatModel.generateContentStream({
        contents,
        systemInstruction: CLARA_SYSTEM_PROMPT,
      });
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      if (err.status === 429 || (err.message && err.message.includes("429"))) {
        console.log("[clara-chat] Gemini rate limit hit (429), falling back to Lovable AI Gateway...");
        useFallback = true;
      } else {
        throw error;
      }
    }

    // Coletar fontes locais
    const localSources = documents?.map(d => d.title) || [];
    
    // Create SSE stream
    const encoder = new TextEncoder();
    
    // Track web sources from grounding metadata
    const webSources: string[] = [];

    // Helper function to log API usage (fire and forget)
    const logApiUsage = async (provider: "gemini" | "lovable", model: string, modeUsed: string) => {
      try {
        await supabase
          .from("api_usage_stats")
          .insert({ provider, model, mode: modeUsed });
        console.log(`[clara-chat] Logged API usage: ${provider}/${model} (${modeUsed})`);
      } catch (err) {
        console.warn("[clara-chat] Failed to log API usage:", err);
      }
    };

    // If we need to use fallback, use Lovable AI Gateway
    if (useFallback) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido e fallback não configurado. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const lovableModelConfig = LOVABLE_MODEL_MAP[mode] || LOVABLE_MODEL_MAP["fast"];
      activeModelName = lovableModelConfig.model;
      apiProvider = "lovable";
      
      // Prepare messages for Lovable AI Gateway (OpenAI format)
      const gatewayMessages = [
        { role: "system", content: CLARA_SYSTEM_PROMPT },
        ...chatHistory.map((msg: { role: string; content: string }) => ({
          role: msg.role,
          content: msg.content,
        })),
        { role: "user", content: userPrompt },
      ];
      
      console.log(`[clara-chat] Using Lovable AI Gateway with model: ${lovableModelConfig.model}`);
      
      // Make request to Lovable AI Gateway
      const gatewayResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: lovableModelConfig.model,
          messages: gatewayMessages,
          temperature: lovableModelConfig.temperature,
          max_tokens: lovableModelConfig.max_tokens,
          stream: true,
        }),
      });
      
      if (!gatewayResponse.ok) {
        if (gatewayResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: "Ambas as APIs atingiram o limite. Tente novamente em alguns minutos." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (gatewayResponse.status === 402) {
          return new Response(
            JSON.stringify({ error: "Créditos esgotados no gateway de fallback." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const errorText = await gatewayResponse.text();
        console.error("[clara-chat] Lovable Gateway error:", gatewayResponse.status, errorText);
        throw new Error(`Gateway error: ${gatewayResponse.status}`);
      }
      
      // Stream from Lovable AI Gateway (OpenAI SSE format)
      const gatewayReader = gatewayResponse.body!.getReader();
      const decoder = new TextDecoder();
      
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Enviar evento de provedor de API (fallback)
            controller.enqueue(encoder.encode(`event: api_provider\ndata: ${JSON.stringify({ provider: apiProvider, model: activeModelName })}\n\n`));
            
            // Enviar evento de início
            controller.enqueue(encoder.encode(`event: thinking\ndata: ${JSON.stringify({ status: "searching", step: "Usando API de fallback..." })}\n\n`));
            
            let buffer = "";
            
            while (true) {
              const { done, value } = await gatewayReader.read();
              if (done) break;
              
              buffer += decoder.decode(value, { stream: true });
              
              // Process complete lines
              let newlineIndex: number;
              while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
                const line = buffer.slice(0, newlineIndex).trim();
                buffer = buffer.slice(newlineIndex + 1);
                
                if (!line || line.startsWith(":")) continue;
                if (!line.startsWith("data: ")) continue;
                
                const jsonStr = line.slice(6).trim();
                if (jsonStr === "[DONE]") continue;
                
                try {
                  const parsed = JSON.parse(jsonStr);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    controller.enqueue(encoder.encode(`event: delta\ndata: ${JSON.stringify({ content })}\n\n`));
                  }
                } catch {
                  // Ignore parse errors for incomplete chunks
                }
              }
            }
            
            // Enviar fontes locais (no web sources from fallback)
            if (localSources.length > 0) {
              controller.enqueue(encoder.encode(`event: sources\ndata: ${JSON.stringify({ local: localSources })}\n\n`));
            }
            
            // Log API usage (fire and forget)
            logApiUsage("lovable", activeModelName, mode);
            
            controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
            controller.close();
          } catch (error) {
            console.error("Erro no streaming (fallback):", error);
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
    }

    // Primary path: Stream from Gemini SDK
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Enviar evento de provedor de API
          controller.enqueue(encoder.encode(`event: api_provider\ndata: ${JSON.stringify({ provider: apiProvider, model: activeModelName })}\n\n`));
          
          // Enviar notice se web search estiver ativo
          if (needsWebSearch) {
            controller.enqueue(encoder.encode(`event: notice\ndata: ${JSON.stringify({ type: "web_search", message: "Consultando fontes externas..." })}\n\n`));
          }
          
          // Enviar evento de início
          const thinkingStep = needsWebSearch 
            ? "Buscando na web e base de conhecimento..." 
            : "Buscando na base de conhecimento...";
          controller.enqueue(encoder.encode(`event: thinking\ndata: ${JSON.stringify({ status: "searching", step: thinkingStep })}\n\n`));
          
          // Process streaming response
          for await (const chunk of result!.stream) {
            const text = chunk.text();
            if (text) {
              controller.enqueue(encoder.encode(`event: delta\ndata: ${JSON.stringify({ content: text })}\n\n`));
            }
            
            // Extract grounding metadata if present (web search sources)
            // Note: SDK has a typo - it's "groundingChuncks" not "groundingChunks"
            // deno-lint-ignore no-explicit-any
            const groundingMeta = (chunk.candidates?.[0] as any)?.groundingMetadata;
            if (groundingMeta?.groundingChuncks) {
              for (const grChunk of groundingMeta.groundingChuncks) {
                if (grChunk.web?.uri && grChunk.web?.title) {
                  const webSource = `${grChunk.web.title} - ${grChunk.web.uri}`;
                  if (!webSources.includes(webSource)) {
                    webSources.push(webSource);
                  }
                }
              }
            }
          }
          
          // Enviar fontes (local + web)
          const sourcesPayload: { local: string[]; web?: string[] } = { local: localSources };
          if (webSources.length > 0) {
            sourcesPayload.web = webSources;
            console.log(`[clara-chat] Web sources found: ${webSources.length}`);
          }
          
          if (localSources.length > 0 || webSources.length > 0) {
            controller.enqueue(encoder.encode(`event: sources\ndata: ${JSON.stringify(sourcesPayload)}\n\n`));
          }
          
          // Log API usage (fire and forget)
          logApiUsage("gemini", activeModelName, mode);
          
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

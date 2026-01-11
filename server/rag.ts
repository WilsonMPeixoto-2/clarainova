import { invokeLLM } from "./_core/llm";
import * as fs from "fs";
import * as path from "path";

// Knowledge base content loaded from text files
let knowledgeBase: { content: string; source: string; section?: string }[] = [];

// ============================================================================
// SYSTEM PROMPT - "O Mentor do SEI"
// ============================================================================
export const SYSTEM_PROMPT = `# O MENTOR DO SEI - Consultor Sênior de Processos da 4ª CRE

## 1. SUA IDENTIDADE E MISSÃO
Você é o **Consultor Sênior de Processos da 4ª CRE (SME-RJ)**. Sua missão não é apenas "buscar texto", mas **resolver a dúvida do Diretor/Gestor**. Você deve agir como um mentor paciente, experiente e extremamente didático, que domina o SEI e as normas administrativas.

## 2. PROTOCOLO COGNITIVO (Como você deve pensar)
Antes de responder, execute estes passos internamente:
1. **Analise a Intenção**: O usuário quer apenas um prazo rápido ou está perdido no processo?
2. **Tradução Técnica**: Leia o trecho técnico do PDF e traduza o "juridiquês" ou "tech-ês" para uma linguagem executiva, clara e direta.
3. **Estruturação**: Quebre procedimentos longos em passos pequenos.
4. **Verificação**: A resposta está completa? Falta algum alerta importante (ex: prazos, multas)?

## 3. DIRETRIZES DE RESPOSTA (A "Qualidade" que exigimos)

### Não seja um Robô
Evite frases como "Conforme consta no documento X". Em vez disso, diga: "Para resolver isso, o procedimento padrão é..." (e cite a fonte no final).

### O Poder do "Como"
Se o usuário perguntar "O que é empenho?", não dê apenas a definição de dicionário. Explique o que é E diga **como isso afeta a vida dele** (ex: "Sem o empenho, o fornecedor não pode entregar o produto...").

### Formatação Visual (OBRIGATÓRIO)
- Use **Listas Numeradas** para passo-a-passo.
- Use **Negrito** para nomes de telas, botões ou prazos fatais.
- Use *Itálico* para observações ou dicas de ouro.
- Use emojis estratégicos: 💡 para dicas, ⚠️ para alertas, ✅ para confirmações.

### Antecipe Dúvidas
Se o procedimento tiver uma "pegadinha" comum (ex: esquecer de assinar ou clicar em concluir), avise proativamente:
> 💡 **Dica de Ouro**: Não esqueça de liberar o acesso externo, senão o fornecedor não vê o documento.

## 4. HIERARQUIA DE RESPOSTA

### NÍVEL 1 (Prioridade Máxima): Base de Conhecimento Local
- Busque a resposta PRIMEIRO nos manuais carregados.
- Se encontrar, responda de forma completa e cite a fonte no final.

### NÍVEL 2 (Fallback): Busca Web Governamental
- APENAS se a resposta não constar nos manuais após duas tentativas de busca.
- **Restrição**: Somente domínios .gov.br, rio.rj.gov.br, Planalto, ALERJ.
- **Aviso**: "Esta informação não consta no manual interno, mas localizei na legislação externa:"

### NÍVEL 3 (Falha): Apenas após esgotar opções
- Só responda "Não encontrei base documental segura" após:
  1. Busca com pergunta original
  2. Busca com pergunta expandida (sinônimos)
  3. Tentativa de busca web

## 5. GUARDRAILS (Segurança)
- **Proteção de Dados**: Se houver dados pessoais, ignore-os e alerte: "⚠️ Por favor, não insira dados pessoais neste chat."
- **Escopo**: Apenas rotinas administrativas da SME. Para outros assuntos: "Sou treinado apenas para rotinas administrativas da SME."
- **Neutralidade**: Nunca emita opiniões jurídicas. Você fornece informações operacionais.

## 6. BASE DE CONHECIMENTO
- Manual do Usuário SEI 4.0
- Cartilha do Usuário SEI
- Manual de Prestação de Contas SDP
- Guia Orientador SDP - 4ª CRE (Circular E/SUBG/CPGOF Nº 06/2024)`;

// ============================================================================
// SINÔNIMOS E EXPANSÃO DE CONSULTAS
// ============================================================================

// Mapa de sinônimos para termos comuns do SEI
const SYNONYM_MAP: Record<string, string[]> = {
  "abrir": ["iniciar", "criar", "gerar", "cadastrar", "autuar", "novo"],
  "iniciar": ["abrir", "criar", "gerar", "cadastrar", "autuar", "novo"],
  "criar": ["abrir", "iniciar", "gerar", "cadastrar", "autuar", "novo"],
  "processo": ["procedimento", "expediente", "protocolo", "nup"],
  "documento": ["arquivo", "anexo", "peça", "ofício", "despacho"],
  "anexar": ["incluir", "inserir", "adicionar", "juntar", "apensar"],
  "assinar": ["autenticar", "validar", "rubricar", "firmar"],
  "tramitar": ["enviar", "encaminhar", "remeter", "transferir", "mover"],
  "fechar": ["concluir", "finalizar", "encerrar", "arquivar"],
  "editar": ["alterar", "modificar", "corrigir", "atualizar"],
  "excluir": ["deletar", "remover", "apagar", "cancelar"],
  "pesquisar": ["buscar", "procurar", "localizar", "consultar"],
  "prestação": ["prestacao", "prestar"],
  "contas": ["conta", "contábil", "financeiro"],
  "sdp": ["sistema descentralizado", "verba", "recurso"],
};

// Intenções conhecidas e suas variações de consulta
const INTENT_QUERIES: Record<string, string[]> = {
  "CREATE_PROCESS": [
    "como iniciar um processo no SEI",
    "como criar um processo no SEI",
    "como autuar um processo no SEI",
    "novo processo SEI",
    "menu Iniciar Processo SEI",
    "gerar processo cadastrar processo SEI",
    "abrir processo SEI passo a passo",
  ],
  "ADD_DOCUMENT": [
    "como incluir documento no SEI",
    "como anexar documento no SEI",
    "adicionar documento externo SEI",
    "inserir arquivo processo SEI",
    "documento externo SEI",
  ],
  "SIGN_DOCUMENT": [
    "como assinar documento SEI",
    "assinatura eletrônica SEI",
    "autenticar documento SEI",
    "validar assinatura SEI",
  ],
  "SEND_PROCESS": [
    "como tramitar processo SEI",
    "enviar processo outra unidade SEI",
    "encaminhar processo SEI",
    "transferir processo SEI",
  ],
  "SDP_PRESTACAO": [
    "prestação de contas SDP",
    "como prestar contas SDP",
    "prestação contas verba SDP",
    "processo prestação SDP 4 CRE",
    "documentos prestação contas SDP",
  ],
  "ACCESS_LEVELS": [
    "níveis de acesso SEI",
    "acesso restrito SEI",
    "acesso sigiloso SEI",
    "acesso público SEI",
    "hipótese legal restrição SEI",
  ],
};

// Classificar intenção da pergunta
function classifyIntent(query: string): string | null {
  const queryLower = query.toLowerCase();
  
  // Verificar padrões de intenção
  if (queryLower.match(/abrir|iniciar|criar|gerar|novo.*processo/)) {
    return "CREATE_PROCESS";
  }
  if (queryLower.match(/anexar|incluir|adicionar|inserir.*documento/)) {
    return "ADD_DOCUMENT";
  }
  if (queryLower.match(/assinar|assinatura|autenticar.*documento/)) {
    return "SIGN_DOCUMENT";
  }
  if (queryLower.match(/tramitar|enviar|encaminhar|transferir.*processo/)) {
    return "SEND_PROCESS";
  }
  if (queryLower.match(/presta[çc][aã]o.*conta|sdp|verba/)) {
    return "SDP_PRESTACAO";
  }
  if (queryLower.match(/n[ií]ve[il].*acesso|acesso.*restrito|sigiloso|p[úu]blico/)) {
    return "ACCESS_LEVELS";
  }
  
  return null;
}

// Expandir consulta com sinônimos
function expandQueryWithSynonyms(query: string): string[] {
  const queries: string[] = [query];
  const queryLower = query.toLowerCase();
  const words = queryLower.split(/\s+/);
  
  // Gerar variações substituindo palavras por sinônimos
  for (const word of words) {
    if (SYNONYM_MAP[word]) {
      for (const synonym of SYNONYM_MAP[word]) {
        const newQuery = queryLower.replace(new RegExp(`\\b${word}\\b`, "gi"), synonym);
        if (!queries.includes(newQuery)) {
          queries.push(newQuery);
        }
      }
    }
  }
  
  // Adicionar consultas baseadas na intenção
  const intent = classifyIntent(query);
  if (intent && INTENT_QUERIES[intent]) {
    for (const intentQuery of INTENT_QUERIES[intent]) {
      if (!queries.includes(intentQuery)) {
        queries.push(intentQuery);
      }
    }
  }
  
  // Limitar a 6 consultas
  return queries.slice(0, 6);
}

// ============================================================================
// CARREGAMENTO DA BASE DE CONHECIMENTO
// ============================================================================

export function loadKnowledgeBase() {
  const knowledgeDir = path.join(process.cwd(), "knowledge-base");
  
  if (!fs.existsSync(knowledgeDir)) {
    console.warn("[RAG] Knowledge base directory not found");
    return;
  }
  
  const files = fs.readdirSync(knowledgeDir).filter(f => f.endsWith(".txt"));
  
  knowledgeBase = [];
  
  for (const file of files) {
    const filePath = path.join(knowledgeDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    
    // AUMENTADO: chunks de 4000 caracteres com overlap de 500
    const chunks = splitIntoChunks(content, 4000, 500);
    
    const sourceName = getSourceName(file);
    
    chunks.forEach((chunk, index) => {
      knowledgeBase.push({
        content: chunk,
        source: sourceName,
        section: `Parte ${index + 1}`
      });
    });
  }
  
  console.log(`[RAG] Loaded ${knowledgeBase.length} chunks from ${files.length} files`);
}

function getSourceName(filename: string): string {
  const nameMap: Record<string, string> = {
    "cartilha_sei_content.txt": "Cartilha do Usuário SEI",
    "manual_sei_4_content.txt": "Manual do Usuário SEI 4.0",
    "manual_usuario_sei_content.txt": "Manual do Usuário SEI",
    "pdf_content.txt": "Manual de Prestação de Contas SDP - 4ª CRE"
  };
  
  return nameMap[filename] || filename.replace(".txt", "");
}

function splitIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  
  return chunks;
}

// ============================================================================
// BUSCA MULTI-QUERY COM SINÔNIMOS
// ============================================================================

// Busca simples para uma única query
function searchSingleQuery(query: string, topK: number): Array<typeof knowledgeBase[0] & { score: number }> {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
  
  const scored = knowledgeBase.map(chunk => {
    const contentLower = chunk.content.toLowerCase();
    let score = 0;
    
    // Exact phrase match (highest score)
    if (contentLower.includes(queryLower)) {
      score += 15;
    }
    
    // Individual word matches
    for (const word of queryWords) {
      const matches = (contentLower.match(new RegExp(`\\b${word}\\b`, "gi")) || []).length;
      score += matches * 2;
    }
    
    // Boost for SEI-specific terms
    const seiTerms = ["sei", "processo", "documento", "tramitar", "assinar", "anexar", "sdp", "prestação", "contas", "iniciar", "menu", "botão", "tela"];
    for (const term of seiTerms) {
      if (queryLower.includes(term) && contentLower.includes(term)) {
        score += 3;
      }
    }
    
    // Boost for action words in how-to queries
    if (queryLower.includes("como")) {
      const actionTerms = ["clique", "selecione", "preencha", "acesse", "digite", "escolha", "confirme", "salve"];
      for (const term of actionTerms) {
        if (contentLower.includes(term)) {
          score += 2;
        }
      }
    }
    
    return { ...chunk, score };
  });
  
  return scored
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// Multi-Query RAG: busca com múltiplas consultas e merge de resultados
export function searchKnowledgeBase(query: string, topK = 12): typeof knowledgeBase {
  if (knowledgeBase.length === 0) {
    loadKnowledgeBase();
  }
  
  // Expandir query com sinônimos
  const expandedQueries = expandQueryWithSynonyms(query);
  console.log(`[RAG] Searching with ${expandedQueries.length} queries:`, expandedQueries);
  
  // Executar busca para cada query
  const allResults = new Map<string, typeof knowledgeBase[0] & { score: number }>();
  
  for (const q of expandedQueries) {
    const results = searchSingleQuery(q, topK);
    
    for (const result of results) {
      const key = `${result.source}-${result.section}`;
      const existing = allResults.get(key);
      
      if (!existing || result.score > existing.score) {
        allResults.set(key, result);
      }
    }
  }
  
  // Ordenar por score e retornar top K
  const merged = Array.from(allResults.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
  
  console.log(`[RAG] Found ${merged.length} unique chunks with scores:`, merged.map(c => ({ source: c.source, section: c.section, score: c.score })));
  
  return merged;
}

// Busca em dois passes (original + expandida)
export function searchWithTwoPasses(query: string, topK = 12): { chunks: typeof knowledgeBase; passUsed: number } {
  // Passo 1: Busca com query original
  const pass1Results = searchSingleQuery(query, topK);
  
  if (pass1Results.length >= 3 && pass1Results[0]?.score >= 10) {
    console.log("[RAG] Pass 1 successful with high confidence");
    return { chunks: pass1Results, passUsed: 1 };
  }
  
  // Passo 2: Busca com queries expandidas
  const expandedQueries = expandQueryWithSynonyms(query);
  const allResults = new Map<string, typeof knowledgeBase[0] & { score: number }>();
  
  // Incluir resultados do passo 1
  for (const result of pass1Results) {
    const key = `${result.source}-${result.section}`;
    allResults.set(key, result);
  }
  
  // Adicionar resultados das queries expandidas
  for (const q of expandedQueries) {
    const results = searchSingleQuery(q, topK);
    for (const result of results) {
      const key = `${result.source}-${result.section}`;
      const existing = allResults.get(key);
      if (!existing || result.score > existing.score) {
        allResults.set(key, result);
      }
    }
  }
  
  const merged = Array.from(allResults.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
  
  console.log(`[RAG] Pass 2 completed with ${merged.length} chunks`);
  return { chunks: merged, passUsed: 2 };
}

// ============================================================================
// FORMATAÇÃO DE CONTEXTO E FONTES
// ============================================================================

export function formatContext(chunks: ReturnType<typeof searchKnowledgeBase>): string {
  if (chunks.length === 0) {
    return "Nenhum conteúdo relevante encontrado na base de conhecimento.";
  }
  
  return chunks
    .map((chunk, i) => `[Fonte ${i + 1}: ${chunk.source}${chunk.section ? ` - ${chunk.section}` : ""}]\n${chunk.content}`)
    .join("\n\n---\n\n");
}

export function formatSources(chunks: ReturnType<typeof searchKnowledgeBase>): { documentTitle: string; section?: string }[] {
  const uniqueSources = new Map<string, { documentTitle: string; section?: string }>();
  
  for (const chunk of chunks) {
    const key = `${chunk.source}-${chunk.section || ""}`;
    if (!uniqueSources.has(key)) {
      uniqueSources.set(key, {
        documentTitle: chunk.source,
        section: chunk.section
      });
    }
  }
  
  return Array.from(uniqueSources.values());
}

// ============================================================================
// FUNÇÃO PRINCIPAL DE CHAT COM RAG
// ============================================================================

export async function chatWithRAG(
  userMessage: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[] = []
): Promise<{ response: string; sources: { documentTitle: string; section?: string }[] }> {
  
  // Busca em dois passes
  const { chunks: relevantChunks, passUsed } = searchWithTwoPasses(userMessage, 12);
  const context = formatContext(relevantChunks);
  const sources = formatSources(relevantChunks);
  
  // Classificar intenção para contexto adicional
  const intent = classifyIntent(userMessage);
  const intentContext = intent ? `\n\n[Intenção detectada: ${intent}]` : "";
  
  // Build messages for LLM
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { 
      role: "system", 
      content: `Contexto relevante da base de conhecimento (${relevantChunks.length} trechos encontrados, passe ${passUsed}):${intentContext}\n\n${context}` 
    }
  ];
  
  // Add conversation history (last 6 messages)
  const recentHistory = conversationHistory.slice(-6);
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }
  
  // Add current user message with instruction
  const enhancedUserMessage = relevantChunks.length === 0 
    ? `${userMessage}\n\n[INSTRUÇÃO: Não foram encontrados trechos relevantes na base de conhecimento. Tente responder com base no seu conhecimento geral sobre o SEI, mas avise que a informação não foi encontrada nos manuais.]`
    : userMessage;
  
  messages.push({ role: "user", content: enhancedUserMessage });
  
  try {
    const result = await invokeLLM({ messages });
    
    const responseContent = result.choices[0]?.message?.content;
    const response = typeof responseContent === "string" 
      ? responseContent 
      : Array.isArray(responseContent) 
        ? responseContent.map(c => c.type === "text" ? c.text : "").join("") 
        : "Desculpe, não consegui processar sua pergunta.";
    
    return { response, sources };
  } catch (error) {
    console.error("[RAG] Error calling LLM:", error);
    throw error;
  }
}

// Initialize knowledge base on module load
loadKnowledgeBase();

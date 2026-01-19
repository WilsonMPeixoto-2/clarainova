import { invokeLLM } from "./_core/llm";
import * as fs from "fs";
import * as path from "path";
import mammoth from "mammoth";
import { searchGovernmentSites, formatWebSearchContext, formatWebSources, WebSearchResult } from "./webSearch";

// Knowledge base content loaded from text files
interface KnowledgeChunk {
  content: string;
  source: string;
  section?: string;
  sourceType?: string;
  updatedAt?: string;
}

let knowledgeBase: KnowledgeChunk[] = [];

// ============================================================================
// SYSTEM PROMPT - CLARA - Consultora de Legislação e Apoio a Rotinas Administrativas
// ============================================================================
export const SYSTEM_PROMPT = `# CLARA - Consultora de Legislação e Apoio a Rotinas Administrativas da 4ª CRE

## 0. EMPATIA COGNITIVA (DIRETRIZ PRIORITÁRIA)

Você deve demonstrar **Empatia Cognitiva** em todas as interações. Reconheça que o usuário (Diretor/Gestor) pode estar estressado ou confuso com a burocracia.

### Linguagem Acolhedora
- Use frases como: "Entendo sua dúvida...", "Fique tranquilo, o passo a passo é simples...", "Vou te guiar por isso..."
- Evite tom robótico ou impessoal. Seja humano e acessível.
- Demonstre compreensão: "Sei que a burocracia pode parecer complicada, mas vamos simplificar juntos."

### Analogias Didáticas
- Ao explicar procedimentos complexos (como SDP), use **analogias do dia a dia** antes de dar o comando técnico.
- Exemplo: "Pense no processo como uma pasta física que você organiza - cada documento é uma folha que você adiciona na ordem correta."
- Isso ajuda o usuário a visualizar o conceito antes de executar.

### Explique o PORQUÊ
- Não diga apenas ONDE clicar, explique **POR QUE** aquela ação é necessária.
- Exemplo: "Clique em **Concluir Processo** - isso é importante porque sinaliza ao sistema que todas as etapas foram cumpridas e libera o processo para a próxima fase."
- O usuário entende melhor quando sabe a razão por trás de cada passo.

### Antecipe a Ansiedade
- Se o procedimento for longo, avise logo no início: "São X passos, mas não se preocupe - vou detalhar cada um."
- Se houver risco de erro comum, alerte com empatia: "💡 Muitos gestores esquecem este passo, então preste atenção especial aqui..."

## 1. SUA IDENTIDADE E MISSÃO
Você é **CLARA: Consultora de Legislação e Apoio a Rotinas Administrativas da 4ª CRE (SME-RJ)**. Sua missão não é apenas "buscar texto", mas **resolver a dúvida do Diretor/Gestor**. Você deve agir como uma consultora paciente, experiente e extremamente didática, que domina o SEI e as normas administrativas.

## 2. ESCOPO AUTORIZADO

### A) Uso do Sistema SEI (federal e SEI!RIO)
- Criação/iniciação de processos, inclusão/anexação de documentos
- Assinatura/autenticação, tramitação, blocos de assinatura
- Organização da árvore, tipos documentais, nível de acesso
- Protocolos, pesquisa, acompanhamentos
- Diferenças e peculiaridades do SEI!RIO (quando houver base)

### B) Rotinas institucionais relacionadas ao SEI no contexto da SME-RJ / 4ª CRE
- Procedimentos de prestação de contas do SDP descritos nos documentos internos e/ou normas oficiais

### C) Normas correlatas ao tema (legislação e atos oficiais)
- Legislação, decretos, resoluções, portarias, manuais oficiais
- Orientações de órgãos oficiais (ex.: CGM-RIO) quando vinculadas ao SEI ou ritos institucionais (ex.: SDP)

## 3. FORA DO ESCOPO (Recusa Controlada)
**NÃO responda nem pesquise sobre:**
- Temas pessoais (saúde, receitas, relacionamentos)
- Política partidária e opinião política
- Esportes e entretenimento (exceto quando for só exemplo)
- Qualquer assunto sem conexão com SEI / SEI!RIO / procedimentos administrativos / prestação de contas do SDP / normas correlatas

**Modelo de recusa sem travar o usuário:**
> "Este assistente é restrito a orientações sobre o SEI/SEI!RIO, rotinas administrativas vinculadas ao SEI e normas correlatas (ex.: SDP/CGM-RIO). Se você desejar, reformule sua pergunta conectando-a a esse escopo."

**Se a pergunta for parcialmente fora do escopo, faça conversão:**
> "Se sua dúvida estiver relacionada ao SEI/SEI!RIO (ex.: organização na árvore, anexação, tramitação), posso orientar. Você se refere ao SEI?"

## 4. PROTOCOLO COGNITIVO (Como você deve pensar)
Antes de responder, execute estes passos internamente:
1. **Analise a Intenção**: O usuário quer apenas um prazo rápido ou está perdido no processo?
2. **Tradução Técnica**: Leia o trecho técnico do PDF e traduza o "juridiquês" ou "tech-ês" para uma linguagem executiva, clara e direta.
3. **Estruturação**: Quebre procedimentos longos em passos pequenos.
4. **Verificação**: A resposta está completa? Falta algum alerta importante (ex: prazos, multas)?

## 5. DIRETRIZES DE RESPOSTA

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

### Perguntas Amplas ("me ensine tudo sobre SEI")
Não recuse. Responda com um "mapa de navegação":
- 5 tópicos essenciais
- Links oficiais (se disponíveis)
- 3 perguntas para refinar

## 6. REGRA DE OURO: NÃO INVENTAR

**NUNCA invente informações.** Se não houver base documental (manual ou fonte oficial), diga claramente:
> "Não localizei essa informação nos manuais disponíveis nem em fontes oficiais. Recomendo consultar [setor/fonte apropriada]."

**Indicar lacunas explicitamente:**
- Se a base responde parcialmente, indique o que foi encontrado E o que não foi.
- Exemplo: "Encontrei o procedimento geral de cancelamento (Manual SEI, p. X), mas não localizei orientação específica sobre [caso particular]. Sugiro consultar a CGM-RIO."

## 7. REGRA ANTI-CONFUSÃO: SEI FEDERAL vs SEI-RIO vs PROCESSO.RIO

**ATENÇÃO:** Existem sistemas distintos que podem ser confundidos:
- **SEI Federal**: Sistema Eletrônico de Informações do Governo Federal (sei.gov.br)
- **SEI!RIO (SEI-Rio)**: Instância do SEI utilizada pelo Município do Rio de Janeiro
- **Processo.Rio**: Sistema de processos administrativos do Município do Rio (DIFERENTE do SEI!RIO)

**Ao responder:**
- Se a pergunta mencionar "SEI-Rio" ou "SEI!RIO", priorize informações específicas da instância municipal.
- Se a pergunta for comparativa ("diferença entre X e Y"), OBRIGATORIAMENTE busque na web para não inventar.
- Se não souber a diferença, diga: "Não tenho informação segura sobre as diferenças entre esses sistemas. Recomendo consultar a CGM-RIO ou o portal oficial."

## 8. HIERARQUIA DE RESPOSTA

### NÍVEL 1 (Prioridade Máxima): Base de Conhecimento Local
- Busque a resposta PRIMEIRO nos manuais carregados.
- Se encontrar, responda de forma completa e cite a fonte no final.

### NÍVEL 2 (Fallback): Busca Web Governamental
**GATILHOS OBRIGATÓRIOS para busca web:**
1. Confiança baixa no RAG (poucos resultados ou score baixo)
2. O usuário pede explicitamente: "o que diz a CGM-RIO...", "qual decreto...", "qual norma..."
3. A resposta exige base normativa (prazos, competência, rito formal)
4. A base interna aborda o "como fazer", mas o usuário pede "onde está previsto" (legislação/ato)
5. **PERGUNTAS COMPARATIVAS**: "diferença entre...", "qual a relação entre...", "X vs Y"
6. **TERMOS FORA DA BASE**: se o termo principal não aparece nos chunks recuperados

**Ranking de prioridade de fontes:**
1. **Autoridade máxima**: rio.rj.gov.br, doweb.rio.rj.gov.br (D.O.M.), páginas oficiais SME/CGM, gov.br, planalto.gov.br, senado.leg.br, camara.leg.br, alerj.rj.gov.br
2. **Complementar (com aviso)**: blogs técnicos, tutoriais, fóruns, empresas/consultorias

**Se a fonte for complementar, rotule:**
> "Fonte não oficial (uso complementar). Para decisões institucionais, priorize a orientação do manual e atos oficiais."

**Ao usar informação da web:**
- Avise: "Esta informação não consta no manual interno, mas localizei em fonte externa: ..."
- Cite o link e, quando for norma, cite artigo/trecho
- Não "invente" clique/fluxo no SEI se não houver manual/guia confiável

### NÍVEL 3 (Resposta com Lacunas): Quando não encontrar tudo
- Se encontrou PARTE da resposta, entregue o que tem e indique a lacuna:
> "Encontrei [X] nos manuais. Porém, não localizei informação sobre [Y]. Para essa parte, recomendo consultar [fonte/setor]."

### NÍVEL 4 (Falha Total): Apenas após esgotar opções
- Só responda "Não encontrei base documental segura para orientar sobre este caso específico." após:
  1. Busca com pergunta original
  2. Busca com pergunta expandida (sinônimos)
  3. Tentativa de busca web

## 9. GUARDRAILS (Segurança)
- **Proteção de Dados**: Se houver dados pessoais, ignore-os e alerte: "⚠️ Por favor, não insira dados pessoais ou sigilosos neste chat."
- **Neutralidade**: Nunca emita opiniões jurídicas. Você fornece informações operacionais.
- **Honestidade**: Se não sabe, diga que não sabe. Não invente.

## 10. BASE DE CONHECIMENTO
- Manual do Usuário SEI 4.0
- Cartilha do Usuário SEI
- Manual de Prestação de Contas SDP
- Guia Orientador SDP - 4ª CRE (Circular E/SUBG/CPGOF Nº 06/2024)
- Guia de Erros no SEI-RJ: Cancelamento e Correção`;

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
  
  const txtFiles = fs.readdirSync(knowledgeDir).filter(f => f.endsWith(".txt"));
  const docxFiles = fs.readdirSync(knowledgeDir).filter(f => f.endsWith(".docx"));
  
  knowledgeBase = [];
  
  // Carregar arquivos TXT
  for (const file of txtFiles) {
    const filePath = path.join(knowledgeDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    
    // AUMENTADO: chunks de 4000 caracteres com overlap de 500
    const chunks = splitIntoChunks(content, 4000, 500);
    
    const sourceName = getSourceName(file);
    
    chunks.forEach((chunk, index) => {
      knowledgeBase.push({
        content: chunk,
        source: sourceName,
        section: `Parte ${index + 1}`,
        sourceType: "pdf",
        updatedAt: "2024-12-01"
      });
    });
  }
  
  console.log(`[RAG] Loaded ${knowledgeBase.length} chunks from ${txtFiles.length} TXT files`);
  
  // Carregar arquivos DOCX de forma assíncrona
  loadDocxFiles(knowledgeDir, docxFiles);
}

// Carregar arquivos DOCX de forma assíncrona
async function loadDocxFiles(knowledgeDir: string, docxFiles: string[]) {
  for (const file of docxFiles) {
    try {
      const filePath = path.join(knowledgeDir, file);
      const buffer = fs.readFileSync(filePath);
      
      // Extrair texto do DOCX preservando estrutura
      const result = await mammoth.extractRawText({ buffer });
      const content = normalizeDocxText(result.value);
      
      // Chunks maiores para DOCX (4000-6000 caracteres)
      const chunks = splitIntoChunks(content, 5000, 600);
      
      const sourceName = getSourceName(file);
      const stats = fs.statSync(filePath);
      const updatedAt = stats.mtime.toISOString().split('T')[0];
      
      chunks.forEach((chunk, index) => {
        knowledgeBase.push({
          content: chunk,
          source: sourceName,
          section: `Seção ${index + 1}`,
          sourceType: "docx",
          updatedAt: updatedAt
        });
      });
      
      console.log(`[RAG] Loaded ${chunks.length} chunks from DOCX: ${file}`);
    } catch (error) {
      console.error(`[RAG] Error loading DOCX ${file}:`, error);
    }
  }
  
  console.log(`[RAG] Total knowledge base: ${knowledgeBase.length} chunks`);
}

// Normalizar texto extraído de DOCX
function normalizeDocxText(text: string): string {
  return text
    // Remover quebras de linha duplicadas
    .replace(/\n{3,}/g, '\n\n')
    // Preservar títulos e numerações
    .replace(/^(\d+\.\s+)/gm, '\n$1')
    // Remover espaços extras
    .replace(/[ \t]+/g, ' ')
    // Limpar início e fim
    .trim();
}

function getSourceName(filename: string): string {
  const nameMap: Record<string, string> = {
    "cartilha_sei_content.txt": "Cartilha do Usuário SEI",
    "manual_sei_4_content.txt": "Manual do Usuário SEI 4.0",
    "manual_usuario_sei_content.txt": "Manual do Usuário SEI",
    "pdf_content.txt": "Manual de Prestação de Contas SDP - 4ª CRE",
    "ErrosnoSEI-RJCancelamentoeCorreção.docx": "Guia de Erros no SEI-RJ: Cancelamento e Correção"
  };
  
  return nameMap[filename] || filename.replace(/\.(txt|docx)$/, "");
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
// DETECÇÃO DE ESCOPO
// ============================================================================

const OUT_OF_SCOPE_PATTERNS = [
  /\b(receita|cozinha|culinária|comida)\b/i,
  /\b(saúde|médico|remédio|doença|sintoma)\b/i,
  /\b(relacionamento|namoro|casamento|amor)\b/i,
  /\b(futebol|basquete|vôlei|esporte|jogo|campeonato|copa)\b/i,
  /\b(política|partido|eleição|voto|candidato|presidente|governador|prefeito)\b/i,
  /\b(filme|série|novela|música|show|entretenimento)\b/i,
  /\b(horóscopo|signo|astrologia)\b/i,
  /\b(piada|humor|engraçado)\b/i,
];

const IN_SCOPE_KEYWORDS = [
  "sei", "sei!rio", "seirio", "processo", "documento", "tramitar", "tramitação",
  "assinar", "assinatura", "anexar", "anexo", "protocolo", "despacho",
  "sdp", "prestação", "contas", "verba", "recurso", "4ª cre", "4 cre", "sme",
  "cgm", "decreto", "lei", "norma", "legislação", "portaria", "resolução",
  "administrativo", "público", "servidor", "unidade", "escola", "diretor",
  "bloco", "árvore", "acesso", "restrito", "sigiloso", "autenticação",
];

const EXPLICIT_WEB_SEARCH_PATTERNS = [
  /\b(o que diz|qual|onde está|onde consta|previsto|legislação|decreto|norma|lei n)\b.*\b(cgm|rio|brasil|federal|municipal)\b/i,
  /\b(cgm-rio|cgm rio|controladoria)\b/i,
  /\bdecreto\s*n?\s*º?\s*\d+/i,
  /\blei\s*n?\s*º?\s*\d+/i,
  /\bportaria\s*n?\s*º?\s*\d+/i,
];

// PERGUNTAS COMPARATIVAS - Gatilho obrigatório para busca web
const COMPARATIVE_PATTERNS = [
  /\b(diferença|diferenças)\s+(entre|de)\b/i,
  /\b(qual\s+a?\s*relação)\s+(entre|de)\b/i,
  /\b(comparar|comparação)\b/i,
  /\b(vs|versus)\b/i,
  /\b(sei-rio|seirio|sei!rio)\s+(e|vs|versus|ou)\s+(processo\.?rio|processo rio)/i,
  /\b(processo\.?rio|processo rio)\s+(e|vs|versus|ou)\s+(sei-rio|seirio|sei!rio)/i,
];

function isComparativeQuestion(query: string): boolean {
  for (const pattern of COMPARATIVE_PATTERNS) {
    if (pattern.test(query)) {
      return true;
    }
  }
  return false;
}

function isOutOfScope(query: string): boolean {
  const queryLower = query.toLowerCase();
  
  // Se contém palavras-chave do escopo, não está fora do escopo
  for (const keyword of IN_SCOPE_KEYWORDS) {
    if (queryLower.includes(keyword)) {
      return false;
    }
  }
  
  // Se corresponde a padrões fora do escopo, está fora
  for (const pattern of OUT_OF_SCOPE_PATTERNS) {
    if (pattern.test(query)) {
      return true;
    }
  }
  
  return false;
}

function needsExplicitWebSearch(query: string): boolean {
  for (const pattern of EXPLICIT_WEB_SEARCH_PATTERNS) {
    if (pattern.test(query)) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// SANITIZAÇÃO DE FONTES DUPLICADAS
// ============================================================================

/**
 * Remove blocos de "Fonte:", "Fontes:", etc. do corpo da resposta do LLM
 * para evitar duplicação (fontes devem aparecer apenas no rodapé)
 */
function sanitizeSourceDuplication(response: string): string {
  // Remover blocos de fontes que o LLM pode ter adicionado no corpo
  let sanitized = response;
  
  // Padrões para detectar blocos de fonte no corpo da resposta
  const sourcePatterns = [
    // "Fonte:" ou "Fontes:" no início de linha, com ou sem conteúdo na mesma linha
    /^[\s]*Fontes?:\s*.*$/gim,
    // "Fonte:" seguido de lista com bullets
    /\n[\s]*Fontes?:\s*\n[\s]*[-•*]\s+.+(\n[\s]*[-•*]\s+.+)*/gim,
    // Seção completa de fontes (título + conteúdo)
    /\n[\s]*#{1,4}\s*Fontes?\s*consultadas?\s*:?\s*\n[\s\S]*?(?=\n#{1,4}\s|\n\n[A-Z]|$)/gim,
    // Referências explícitas como "[Fonte: ...]"
    /\[Fonte:\s*[^\]]+\]/gi,
    // Padrão "Fontes consultadas:" seguido de conteúdo até o próximo parágrafo
    /\n[\s]*Fontes?\s+consultadas?:?\s*\n[\s\S]*?(?=\n\n|$)/gim,
  ];
  
  for (const pattern of sourcePatterns) {
    sanitized = sanitized.replace(pattern, '');
  }
  
  // Remover múltiplas linhas em branco consecutivas
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
  
  // Limpar espaços no final
  sanitized = sanitized.trim();
  
  return sanitized;
}

// ============================================================================
// FUNÇÃO PRINCIPAL DE CHAT COM RAG
// ============================================================================

export async function chatWithRAG(
  userMessage: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[] = []
): Promise<{ response: string; sources: { documentTitle: string; section?: string; link?: string }[]; usedWebSearch: boolean }> {
  
  // Verificar se está fora do escopo
  if (isOutOfScope(userMessage)) {
    console.log("[RAG] Query detected as out of scope");
    return {
      response: "Este assistente é restrito a orientações sobre o SEI/SEI!RIO, rotinas administrativas vinculadas ao SEI e normas correlatas (ex.: SDP/CGM-RIO). Se você desejar, reformule sua pergunta conectando-a a esse escopo.",
      sources: [],
      usedWebSearch: false
    };
  }
  
  // Busca em dois passes
  const { chunks: relevantChunks, passUsed } = searchWithTwoPasses(userMessage, 12);
  let context = formatContext(relevantChunks);
  let sources: { documentTitle: string; section?: string; link?: string }[] = formatSources(relevantChunks);
  let usedWebSearch = false;
  let webSearchResults: WebSearchResult[] = [];
  
  // Classificar intenção para contexto adicional
  const intent = classifyIntent(userMessage);
  const intentContext = intent ? `\n\n[Intenção detectada: ${intent}]` : "";
  
  // ============================================================================
  // FALLBACK WEB: Critérios expandidos para busca web
  // ============================================================================
  const lowConfidence = relevantChunks.length < 3 || 
    (relevantChunks.length > 0 && (relevantChunks[0] as any).score < 8);
  const explicitRequest = needsExplicitWebSearch(userMessage);
  const isComparative = isComparativeQuestion(userMessage);
  
  // GATILHO OBRIGATÓRIO: perguntas comparativas SEMPRE buscam na web
  const needsWebSearch = lowConfidence || explicitRequest || isComparative;
  
  if (isComparative) {
    console.log("[RAG] Comparative question detected - mandatory web search");
  }
  
  if (needsWebSearch) {
    console.log("[RAG] Insufficient local results, trying web search fallback...");
    
    try {
      // Limitar a 8 resultados máximos conforme especificação
      const webResponse = await searchGovernmentSites(userMessage, 8);
      
      if (webResponse.success && webResponse.results.length > 0) {
        usedWebSearch = true;
        webSearchResults = webResponse.results;
        
        // Adicionar contexto da busca web
        const webContext = formatWebSearchContext(webSearchResults);
        context += webContext;
        
        // Adicionar fontes web (limitar a 8 links)
        const webSources = formatWebSources(webSearchResults.slice(0, 8));
        sources = [...sources, ...webSources];
        
        console.log(`[RAG] Web search added ${webSearchResults.length} results`);
      }
    } catch (error) {
      console.error("[RAG] Web search fallback error:", error);
    }
  }
  
  // Build messages for LLM
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { 
      role: "system", 
      content: `Contexto relevante da base de conhecimento (${relevantChunks.length} trechos encontrados, passe ${passUsed}${usedWebSearch ? " + busca web" : ""}):${intentContext}\n\n${context}\n\n[IMPORTANTE: NÃO inclua seções de "Fonte:", "Fontes:" ou referências no corpo da sua resposta. As fontes serão exibidas automaticamente no rodapé pelo sistema.]` 
    }
  ];
  
  // Add conversation history (last 6 messages)
  const recentHistory = conversationHistory.slice(-6);
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }
  
  // Add current user message with instruction based on search results
  let enhancedUserMessage = userMessage;
  
  if (relevantChunks.length === 0 && !usedWebSearch) {
    enhancedUserMessage = `${userMessage}\n\n[INSTRUÇÃO: Não foram encontrados trechos relevantes na base de conhecimento nem na busca web. Responda: "Não encontrei base documental segura para orientar sobre este caso específico." e sugira que o usuário reformule a pergunta ou consulte a equipe técnica.]`;
  } else if (relevantChunks.length === 0 && usedWebSearch) {
    enhancedUserMessage = `${userMessage}\n\n[INSTRUÇÃO: A informação não foi encontrada nos manuais internos, mas foram encontrados resultados em fontes governamentais externas. OBRIGATORIAMENTE inicie sua resposta com: "Esta informação não consta no manual interno, mas localizei na legislação externa:" e cite as fontes web ao final.]`;
  } else if (usedWebSearch) {
    enhancedUserMessage = `${userMessage}\n\n[INSTRUÇÃO: Além dos manuais internos, foram consultadas fontes governamentais externas para complementar a resposta. Se usar informações da web, indique claramente que são de fontes externas.]`;
  }
  
  messages.push({ role: "user", content: enhancedUserMessage });
  
  try {
    const result = await invokeLLM({ messages });
    
    const responseContent = result.choices[0]?.message?.content;
    let response = typeof responseContent === "string" 
      ? responseContent 
      : Array.isArray(responseContent) 
        ? responseContent.map(c => c.type === "text" ? c.text : "").join("") 
        : "Desculpe, não consegui processar sua pergunta.";
    
    // Sanitizar duplicação de fontes no corpo da resposta
    response = sanitizeSourceDuplication(response);
    
    return { response, sources, usedWebSearch };
  } catch (error) {
    console.error("[RAG] Error calling LLM:", error);
    throw error;
  }
}

// Initialize knowledge base on module load
loadKnowledgeBase();

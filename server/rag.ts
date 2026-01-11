import { invokeLLM } from "./_core/llm";
import * as fs from "fs";
import * as path from "path";

// Knowledge base content loaded from text files
let knowledgeBase: { content: string; source: string; section?: string }[] = [];

// System prompt for the SEI assistant
export const SYSTEM_PROMPT = `Você é um assistente técnico institucional especializado no Sistema SEI (SEI-Rio quando aplicável) e em rotinas administrativas descritas nos manuais carregados neste aplicativo.

Regras obrigatórias:

1. Nunca invente informações. Se não houver base nos documentos indexados, responda: "Não encontrei base documental para esta pergunta nos manuais disponíveis. Posso tentar buscar informações na web, se desejar."

2. Cite fontes: documento, seção e página(s). Em cada resposta, inclua um bloco final "**Fontes consultadas**", com no mínimo 1 citação quando houver resposta.

3. Explique com clareza operacional: quando a pergunta for "como fazer", responda em passos numerados.

4. Tratamento de ambiguidades: se existirem dois caminhos no manual, apresente ambos e indique quando cada um se aplica.

5. Sem dados pessoais: não solicite nem retenha dados pessoais. Se o usuário inserir dados pessoais, oriente a removê-los.

6. Escopo: responda sobre funcionalidades, fluxos e boas práticas descritas nos manuais. Não substitui normas internas nem parecer jurídico.

7. Estilo: português do Brasil, tom formal, preciso e pedagógico, sem informalidades.

Você tem acesso aos seguintes documentos da base de conhecimento:
- Manual do Usuário SEI 4.0
- Cartilha do Usuário SEI
- Manual de Prestação de Contas SDP (Sistema Descentralizado de Pagamento)
- Guia Orientador SDP - 4ª CRE

Responda sempre com base nestes documentos. Se a informação não estiver disponível, indique claramente.`;

// Load knowledge base from text files
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
    
    // Split content into chunks of ~2000 characters with overlap
    const chunks = splitIntoChunks(content, 2000, 200);
    
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

// Simple keyword-based search for relevant chunks
export function searchKnowledgeBase(query: string, topK = 5): typeof knowledgeBase {
  if (knowledgeBase.length === 0) {
    loadKnowledgeBase();
  }
  
  // Normalize query
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
  
  // Score each chunk based on keyword matches
  const scored = knowledgeBase.map(chunk => {
    const contentLower = chunk.content.toLowerCase();
    let score = 0;
    
    // Exact phrase match (highest score)
    if (contentLower.includes(queryLower)) {
      score += 10;
    }
    
    // Individual word matches
    for (const word of queryWords) {
      const matches = (contentLower.match(new RegExp(word, "g")) || []).length;
      score += matches;
    }
    
    // Boost for SEI-specific terms
    const seiTerms = ["sei", "processo", "documento", "tramitar", "assinar", "anexar", "sdp", "prestação", "contas"];
    for (const term of seiTerms) {
      if (queryLower.includes(term) && contentLower.includes(term)) {
        score += 2;
      }
    }
    
    return { ...chunk, score };
  });
  
  // Sort by score and return top K
  return scored
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// Format context from relevant chunks
export function formatContext(chunks: ReturnType<typeof searchKnowledgeBase>): string {
  if (chunks.length === 0) {
    return "Nenhum conteúdo relevante encontrado na base de conhecimento.";
  }
  
  return chunks
    .map((chunk, i) => `[Fonte ${i + 1}: ${chunk.source}${chunk.section ? ` - ${chunk.section}` : ""}]\n${chunk.content}`)
    .join("\n\n---\n\n");
}

// Format sources for citation
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

// Main chat function with RAG
export async function chatWithRAG(
  userMessage: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[] = []
): Promise<{ response: string; sources: { documentTitle: string; section?: string }[] }> {
  // Search for relevant context
  const relevantChunks = searchKnowledgeBase(userMessage, 5);
  const context = formatContext(relevantChunks);
  const sources = formatSources(relevantChunks);
  
  // Build messages for LLM
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { 
      role: "system", 
      content: `Contexto relevante da base de conhecimento:\n\n${context}` 
    }
  ];
  
  // Add conversation history (last 6 messages)
  const recentHistory = conversationHistory.slice(-6);
  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }
  
  // Add current user message
  messages.push({ role: "user", content: userMessage });
  
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

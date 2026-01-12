# Central de Inteligência SEI!RIO - TODO

## Estrutura Base
- [x] Configurar variáveis de ambiente para GOOGLE_GENERATIVE_AI_API_KEY
- [x] Copiar PDFs da base de conhecimento para o projeto

## Backend - Lógica RAG
- [x] Criar schema de banco para documentos e chunks
- [x] Implementar processamento de PDF (extração de texto e chunking)
- [x] Implementar geração de embeddings para chunks
- [x] Criar procedure tRPC para chat com RAG
- [x] Implementar busca vetorial nos chunks
- [x] Configurar integração com Gemini (google-gemini-1.5-flash)
- [ ] Implementar fallback para busca web (googleSearch)
- [x] Adicionar system prompt com instruções mestras

## Frontend - Landing Page
- [x] Criar design institucional (cores azul escuro/branco do SEI RIO)
- [x] Implementar header com logo e título
- [x] Criar seção hero com descrição do sistema
- [x] Implementar área de chat centralizada
- [x] Adicionar exemplos de perguntas prontas
- [x] Criar painel lateral de base de conhecimento
- [ ] Implementar funcionalidade de upload de PDF

## Chat Interface
- [x] Criar componente de chat com histórico
- [ ] Implementar streaming de respostas
- [x] Adicionar renderização de markdown nas respostas
- [x] Mostrar fontes consultadas nas respostas
- [x] Implementar loading states

## Testes
- [x] Criar testes para procedures do chat
- [x] Testar fluxo completo de RAG

## Atualização do Prompt Mestre
- [x] Implementar novo system prompt com hierarquia de resposta (Nível 1, 2, 3)
- [x] Adicionar regras de formatação e estilo (passo a passo, destaques, citações)
- [x] Implementar guardrails de segurança (proteção de dados, escopo negativo)
- [x] Atualizar identidade do assistente para 4ª CRE

## Correções RAG - Debug & Tuning
- [x] Implementar Multi-Query RAG com expansão automática de consultas
- [x] Classificar intenção da pergunta (CREATE_PROCESS, etc)
- [x] Gerar 3-6 consultas alternativas com sinônimos
- [x] Aumentar Top-K para 12 chunks
- [x] Aumentar tamanho dos chunks para 4000 caracteres com overlap de 500
- [x] Implementar dois passes antes de negar (original + expandida)
- [ ] Implementar fallback web obrigatório com Google Search
- [ ] Restringir busca web a domínios .gov.br
- [x] Atualizar System Prompt para "O Mentor do SEI"
- [x] Adicionar protocolo cognitivo (análise de intenção, tradução técnica)
- [x] Implementar formatação visual obrigatória (listas, negrito, itálico)
- [x] Adicionar dicas de ouro e antecipação de dúvidas

## Fallback de Busca Web
- [x] Criar serviço de busca web com Google Search API
- [x] Restringir busca a domínios governamentais (.gov.br, rio.rj.gov.br, planalto.gov.br)
- [x] Integrar fallback no fluxo RAG após dois passes sem resultado
- [x] Adicionar aviso obrigatório quando resposta vier da web
- [x] Testar fallback com perguntas fora do escopo dos manuais

## Diretrizes de Escopo e Fallback Web Governado (v2)
- [x] Implementar escopo definido: SEI/SEI!RIO, rotinas SME-RJ/4ª CRE, normas correlatas
- [x] Adicionar recusa controlada para temas fora do escopo (saúde, política, esportes)
- [x] Implementar modelo de recusa amigável com sugestão de reformulação
- [x] Atualizar critérios de disparo do web search (confiança baixa, pedido explícito, base normativa)
- [x] Implementar ranking de prioridade de fontes (oficial vs complementar)
- [x] Adicionar rótulo para fontes não oficiais (uso complementar)
- [x] Implementar conversão de perguntas parcialmente fora do escopo
- [x] Adicionar "mapa de navegação" para perguntas amplas
- [x] Citar links e artigos/trechos quando usar normas da web


## Upgrade de Inteligência e Humanização
- [x] Atualizar modelo para gemini-1.5-pro-latest (privilegiar qualidade sobre velocidade)
- [x] Ajustar temperature para 0.5 (equilíbrio precisão técnica e fluidez)
- [x] Adicionar camada de Empatia Cognitiva no system prompt
- [x] Implementar linguagem acolhedora (Entendo sua dúvida, Fique tranquilo)
- [x] Adicionar analogias didáticas antes de comandos técnicos
- [x] Explicar o PORQUÊ de cada ação, não apenas onde clicar


## Upgrade para Gemini 3
- [x] Atualizar modelo para gemini-3-pro-preview
- [x] Configurar thinking_level para 'high'
- [x] Implementar fallback para gemini-1.5-pro-latest em caso de erro
- [x] Testar funcionamento do novo modelo


## Melhorias de UX - Caixa de Input do Chat
- [x] Trocar input simples por textarea expansível
- [x] Aumentar altura mínima (min-h-[80px] ou rows={3})
- [x] Adicionar padding interno generoso (p-4)
- [x] Melhorar contraste com borda visível (border-2 border-slate-300)
- [x] Adicionar sombra suave (shadow-md)
- [x] Implementar estado de foco (focus:border-blue-600 focus:ring-2)
- [x] Garantir fundo branco puro (bg-white)
- [x] Posicionar botão de enviar dentro da caixa com destaque visual


## Notas de Governança e Ressalvas
- [x] Adicionar seção "Sobre este assistente" com texto de ferramenta em desenvolvimento
- [x] Adicionar seção "Ressalva" sobre caráter orientativo das respostas
- [x] Adicionar seção "Limites de atuação e governança" sobre escopo do conteúdo
- [x] Adicionar seção "Complemento por busca externa" sobre filtros de escopo
- [x] Ajustar rodapé para versão neutra ("Projeto em desenvolvimento pela 4ª CRE — Versão de testes")
- [x] Adicionar linha discreta "Uso interno orientativo — sujeito a validação por fontes oficiais"
- [x] Substituir "foi treinado" por "responde com base em" ou "foi alimentado com"
- [x] Remover menções institucionais oficiais (SME, Secretaria Municipal de Educação)
- [x] Manter apenas "4ª CRE" como unidade desenvolvedora
- [x] Usar termos neutros: "iniciativa interna", "projeto em testes", "ferramenta em desenvolvimento"


## Ajustes Estéticos e de Governança (v2)
- [x] Adicionar texto explícito "Este ambiente não constitui canal oficial..." em "Sobre este assistente"
- [x] Atualizar "Limites de atuação" com texto sobre documentação oficial SEI Federal e SEI!RIO
- [x] Atualizar "Busca externa" com texto sobre fontes .gov.br e indicação de links
- [x] Adicionar badge "Versão de testes (Beta)" no header
- [x] Aplicar alinhamento justificado em todos os textos do painel direito
- [x] Padronizar cards com verbos no infinitivo (Abrir, Anexar, Fazer, Consultar)
- [x] Adicionar feedback visual de clique nos cards (hover, sombra, cursor pointer)
- [x] Adicionar 2 exemplos avançados (Assinar/autenticar, Tramitar para outra unidade)
- [x] Adicionar "Base atualizada em: DD/MM/AAAA" na seção Base de Conhecimento
- [x] Aumentar line-height dos parágrafos do painel direito
- [x] Reduzir tamanho do texto de rodapé
- [x] Garantir consistência de títulos (mesmo peso e tamanho)

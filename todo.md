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


## Página de Relatório Técnico
- [x] Criar página dedicada /relatorio-tecnico com design profissional
- [x] Implementar navegação entre Home e Relatório Técnico
- [x] Aplicar design institucional consistente com o restante do site
- [x] Incluir todas as 7 seções do relatório com formatação visual
- [x] Adicionar diagrama de arquitetura visual
- [x] Implementar tabelas estilizadas para stack e configurações
- [x] Adicionar botão de impressão/download
- [x] Testar responsividade e salvar checkpoint


## Upgrade A: Ingestão de Documento DOCX
- [x] Implementar suporte a extração de texto de arquivos DOCX
- [x] Preservar headings (H1/H2/H3), listas e tabelas na extração
- [x] Normalizar texto (remover quebras duplicadas, manter títulos e numerações)
- [x] Configurar chunk size de 4000-6000 caracteres com overlap de 500
- [x] Adicionar metadados obrigatórios (source_title, source_type, section_path, updated_at)
- [x] Ingerir documento "ErrosnoSEI-RJCancelamentoeCorreção.docx"
- [ ] Exibir novo documento na UI Base de Conhecimento
- [ ] Criar teste automatizado para busca de termo exclusivo do DOCX

## Upgrade B: Protocolo de Web Fallback Aprimorado
- [x] Adicionar Regra de Ouro: NÃO INVENTAR no System Prompt
- [x] Adicionar Regra Anti-Confusão (SEI Federal vs SEI-Rio vs Processo.Rio)
- [x] Implementar gatilhos obrigatórios para busca web (perguntas comparativas, termos fora da base)
- [x] Adicionar formato de resposta com lacunas (indicar explicitamente o que não foi encontrado)
- [x] Testar com pergunta comparativa "diferença entre SEI-Rio e Processo.Rio"

## Transformação em Site Permanente (Produção)

### Fase 1: Configuração de Produção
- [x] Remover referências institucionais específicas (SME, CRE, SEI RIO)
- [x] Implementar fallback automático Gemini → Forge API
- [x] Corrigir validação de sessionId
- [ ] Configurar variáveis de ambiente de produção
- [ ] Implementar logging estruturado para monitoramento
- [ ] Configurar rate limiting e proteção contra abuso
- [ ] Implementar CORS e segurança de headers

### Fase 2: Persistência de Dados
- [x] Criar tabela de histórico de chats no banco de dados
- [x] Implementar salvar/carregar histórico de conversas
- [x] Adicionar timestamps e metadados de sessão
- [ ] Implementar limpeza automática de sessões antigas (>30 dias)
- [ ] Criar índices para performance de busca

### Fase 3: Otimização de Performance
- [ ] Implementar cache de respostas frequentes
- [ ] Otimizar queries de busca vetorial (HNSW)
- [ ] Implementar compressão de resposta (gzip)
- [ ] Adicionar lazy loading para documentos da base
- [ ] Otimizar bundle size do frontend

### Fase 4: SEO e Metadados
- [ ] Adicionar meta tags (title, description, og:image)
- [ ] Implementar sitemap.xml
- [ ] Adicionar robots.txt
- [ ] Implementar schema.org para rich snippets
- [ ] Configurar Google Analytics

### Fase 5: Funcionalidades Adicionais
- [ ] Implementar feedback de usuário (thumbs up/down)
- [ ] Adicionar exportação de conversa em PDF
- [ ] Implementar busca no histórico de chats
- [ ] Adicionar modo escuro/claro
- [ ] Implementar temas de cores customizáveis

### Fase 6: Documentação e Deploy
- [ ] Criar documentação técnica (README.md)
- [ ] Documentar API endpoints
- [ ] Criar guia de instalação e deployment
- [ ] Configurar CI/CD pipeline
- [ ] Criar checkpoint final
- [ ] Publicar site em produção

### Fase 7: Monitoramento Pós-Launch
- [ ] Configurar alertas de erro
- [ ] Implementar health checks
- [ ] Monitorar latência de resposta
- [ ] Coletar métricas de uso
- [ ] Planejar melhorias baseadas em feedback


## Melhorias Estéticas Premium (Fevereiro 2026)

### Fase 1: Paleta de Cores Moderna
- [x] Atualizar paleta de cores em index.css (Âmbar + Turquesa)
- [x] Adicionar cor accent vibrante (oklch(0.65 0.18 40))
- [x] Adicionar cor complementar turquesa (oklch(0.50 0.15 200))
- [x] Testar contraste WCAG AA

### Fase 2: Layout do Chat
- [x] Aumentar área do chat para 70-80% da largura em desktop
- [x] Centralizar chat com margens iguais
- [x] Remover layout de duas colunas (lg:flex-row)
- [x] Mover sidebar para drawer/modal em mobile
- [x] Aumentar max-width para max-w-5xl

### Fase 3: Tipografia Refinada
- [x] Aumentar line-height (h1: 1.3, body: 1.7)
- [x] Adicionar letter-spacing sutil (h1: -0.02em, body: 0.3px)
- [x] Ajustar escala de tamanhos (h1: 3rem, h2: 2.25rem)
- [x] Usar Inter 700 para títulos

### Fase 4: Espaçamento Generoso
- [x] Aumentar padding vertical (py-4 → py-8)
- [x] Aumentar gap entre elementos (gap-3 → gap-4)
- [x] Aumentar padding interno dos cards (p-4 → p-5)
- [x] Melhorar espaçamento de mensagens (px-4 py-3 → px-5 py-4)

### Fase 5: Animações e Microinterações
- [x] Adicionar hover effects nos botões (translateY, box-shadow)
- [x] Animar entrada dos cards de exemplo (slideInUp)
- [x] Adicionar typing indicator animado
- [x] Melhorar hover nos cards de exemplo
- [x] Adicionar animação ao enviar mensagem

### Fase 6: Header Premium
- [x] Aumentar tamanho do logo (w-12 → w-14)
- [x] Adicionar glow effect no logo
- [ ] Animar badge Beta com pulse
- [ ] Melhorar gradient do header
- [ ] Adicionar box-shadow no header

### Fase 7: Chat Interface Premium
- [x] Melhorar styling de mensagens (gradient, box-shadow)
- [ ] Adicionar avatar/ícone nas mensagens do assistente
- [ ] Melhorar input de texto (border, focus states)
- [ ] Adicionar indicador de digitação animado
- [ ] Melhorar renderização de fontes

### Fase 8: Footer Profissional
- [x] Criar footer com 3 colunas (Sobre, Recursos, Importante)
- [x] Adicionar links úteis
- [x] Adicionar copyright
- [x] Estilizar com gradient consistente

### Fase 9: Apoio Visual com Ícones (Futuro)
- [ ] Criar componente IconReference.tsx
- [ ] Criar biblioteca de 25+ ícones comuns
- [ ] Atualizar prompt do LLM para usar [icon:nome]
- [ ] Integrar com Streamdown
- [ ] Testar com respostas reais


## Design System GovTech Premium - Nível Awwwards (Fevereiro 2026)

### Fase 1: Paleta OKLCH Premium (Deep Navy + Luminous Amber)
- [x] Implementar Deep Navy (quase preto com subtom azul índigo)
- [x] Criar Luminous Amber com gradientes sutis (não cores chapadas)
- [x] Definir variáveis para vidros (glass) com diferentes opacidades
- [x] Adicionar noise texture aos surfaces
- [x] Configurar cores para glow effects

### Fase 2: Tipografia Editorial Premium
- [x] Importar Plus Jakarta Sans (300-700) para headings
- [x] Importar Geist Sans ou manter Inter para body
- [x] Configurar letter-spacing apertado (-0.02em) para headings
- [x] Ajustar escala tipográfica para máxima legibilidade
- [x] Implementar hierarquia visual clara

### Fase 3: Mesh Gradient Animado
- [x] Criar background com mesh gradient animado
- [x] Implementar animação CSS keyframes (movimento lento)
- [x] Adicionar noise texture ao gradient
- [x] Otimizar performance da animação
- [x] Testar em diferentes resoluções

### Fase 4: Glass Morphism Premium
- [x] Criar classe .glass-premium com backdrop-filter: blur(20px)
- [x] Adicionar borda interna 1px branca (10% opacidade)
- [x] Implementar sombra interna para volume 3D
- [x] Criar variações de glass (light, medium, heavy)
- [x] Adicionar noise texture aos vidros

### Fase 5: Glow Effects e Sombras Coloridas
- [x] Substituir sombras pretas por sombras coloridas
- [x] Criar classes utilitárias para glow effects
- [x] Implementar glow no logo e elementos principais
- [x] Adicionar glow effects nos hovers
- [x] Configurar cores de glow baseadas na paleta

### Fase 6: Imagens 4K de Alta Qualidade
- [ ] Buscar imagens 4K relacionadas a IA/tecnologia
- [ ] Otimizar imagens para web (WebP, AVIF)
- [ ] Adicionar lazy loading
- [ ] Implementar placeholders blur
- [ ] Testar em diferentes resoluções

### Fase 7: Configuração Tailwind Premium
- [ ] Estender tailwind.config.js com cores OKLCH
- [ ] Adicionar utilitários customizados (glass, glow)
- [ ] Configurar animações customizadas
- [ ] Adicionar plugins necessários
- [ ] Otimizar purge/safelist

### Fase 8: Refinamentos Finais
- [ ] Testar em diferentes navegadores
- [ ] Otimizar performance (Lighthouse 90+)
- [ ] Validar acessibilidade (WCAG AA)
- [ ] Testar responsividade completa
- [ ] Criar checkpoint e push para clarainova

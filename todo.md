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

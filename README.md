# CLARA — Central de Inteligência SEI!RIO

> ⚠️ **Este projeto usa exclusivamente `npm` como gerenciador de pacotes.**
> Lockfiles de outros gerenciadores (`bun.lock`, `pnpm-lock.yaml`, `yarn.lock`) **não são suportados** e serão ignorados via `.gitignore`.
> Use apenas `npm install` e `npm run <script>`.

Sistema de chat RAG (Retrieval-Augmented Generation) especializado em fornecer assistência sobre o Sistema Eletrônico de Informações (SEI) e procedimentos de prestação de contas do SDP.

## 🚀 Características

- **Chat RAG com IA**: Respostas baseadas em inteligência artificial com fontes verificáveis
- **Busca Web Integrada**: Complementa respostas com informações de fontes governamentais externas
- **Base de Conhecimento**: Sistema indexado com documentação oficial do SEI
- **Interface Pública**: Acesso sem necessidade de login
- **Histórico de Conversas**: Mantém contexto para melhor experiência

## 📋 Pré-requisitos

- Node.js 18+
- npm (incluído com Node.js)

## 🔧 Instalação

```bash
# Clone o repositório
git clone https://github.com/WilsonMPeixoto-2/central-inteligencia-sei.git
cd central-inteligencia-sei

# Instale as dependências (APENAS npm)
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

O aplicativo estará disponível em `http://localhost:8080`

## 🏗️ Build para Produção

```bash
npm run build
npm start
```

## 🛠️ Scripts Disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor de desenvolvimento |
| `npm run build` | Compila o projeto para produção |
| `npm run build:dev` | Build em modo desenvolvimento |
| `npm start` | Preview do build de produção |
| `npm run check` | Verifica tipos TypeScript |
| `npm run format` | Formata o código com Prettier |
| `npm test` | Executa testes com Vitest |

## 📁 Estrutura do Projeto

```
.
├── src/                    # Código-fonte frontend (React + TypeScript)
│   ├── components/         # Componentes React
│   │   ├── chat/           # Componentes do chat (input, mensagens, sidebar)
│   │   └── ui/             # Componentes UI reutilizáveis (shadcn/ui)
│   ├── contexts/           # Contextos React (ThemeContext)
│   ├── hooks/              # Hooks customizados
│   ├── integrations/       # Integrações (Supabase client + types)
│   ├── pages/              # Páginas da aplicação
│   └── lib/                # Utilitários
├── supabase/
│   ├── functions/          # Edge Functions (backend serverless)
│   │   ├── clara-chat/     # Função principal do chat RAG
│   │   └── re-embed-chunks/ # Reprocessamento de embeddings
│   └── migrations/         # Migrações do banco de dados
├── knowledge-base/         # Documentos da base de conhecimento
├── package.json            # Dependências e scripts (npm apenas)
├── package-lock.json       # Lockfile oficial (npm)
├── vite.config.ts          # Configuração do Vite
├── tsconfig.json           # Configuração do TypeScript
└── vitest.config.ts        # Configuração de testes
```

## 📚 Base de Conhecimento

Documentos indexados:

1. **Manual do Usuário SEI 4.0** — Guia completo de operações
2. **Cartilha do Usuário SEI** — Orientações práticas
3. **Manual de Prestação de Contas SDP** — Procedimentos para prestação de contas
4. **Guia Orientador SDP** — Circular E/SUBG/CPGOF Nº 06/2024

## 🔒 Segurança

- ⚠️ Não commite o arquivo `.env` com credenciais reais
- Use variáveis de ambiente para informações sensíveis
- O backend roda em Edge Functions com secrets gerenciados pelo Lovable Cloud

## ⚙️ Gerenciador de Pacotes

**Este projeto usa exclusivamente `npm`.**

❌ Não use `bun`, `pnpm` ou `yarn`
❌ Não crie `bun.lock`, `pnpm-lock.yaml` ou `yarn.lock`
❌ Não adicione `packageManager` ou blocos `pnpm`/`bun` ao `package.json`

O `.gitignore` bloqueia lockfiles de outros gerenciadores automaticamente.

## 📝 Stack Técnico

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4
- **UI**: shadcn/ui + Radix Primitives + Framer Motion
- **Backend**: Lovable Cloud (Supabase Edge Functions)
- **IA**: Lovable AI Gateway (Gemini / GPT)
- **Banco de Dados**: PostgreSQL (via Lovable Cloud)
- **Busca**: Hybrid Search (vetorial + keyword) com pgvector

## 🤝 Contribuindo

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. **Use apenas `npm install`** para instalar dependências
4. Commit suas mudanças (`git commit -m 'feat: minha feature'`)
5. Push para a branch (`git push origin feature/MinhaFeature`)
6. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT.

## 👥 Autores

- 4ª CRE — Coordenadoria Regional de Educação

---

**Aviso**: Este é um projeto em desenvolvimento, em fase de validação e aprimoramento. Não constitui canal oficial do Município do Rio de Janeiro ou do sistema SEI!RIO.

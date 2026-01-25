
# Plano: Sistema de Login com Página de Entrada Minimalista

## Resumo

Implementar sistema completo de autenticação Google OAuth com uma página de login dedicada, inspirada no design sóbrio que você compartilhou. A página será a nova "porta de entrada" da CLARA.

---

## Design da Página de Login

### Inspiração Visual (da sua referência)

A página seguirá exatamente o estilo mostrado:
- Fundo navy profundo (#0A1628)
- Conteúdo centralizado verticalmente
- Título em duas linhas: "Inteligência" (peso leve) + "Administrativa" (peso bold)
- Subtítulo com acrônimo C-L-A-R-A destacado em âmbar
- Botões centralizados abaixo

### Layout Proposto

```text
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                                                                 │
│                                                                 │
│                                                                 │
│                       Inteligência                              │
│                     Administrativa                              │
│                                                                 │
│         Consultora de Legislação e Apoio a Rotinas              │
│                      Administrativas                            │
│              (C, L, A, R, A em âmbar)                           │
│                                                                 │
│                 ┌────────────────────────┐                      │
│                 │   G  Entrar com Google │                      │
│                 └────────────────────────┘                      │
│                                                                 │
│                      ─────── ou ───────                         │
│                                                                 │
│                   Continuar sem login →                         │
│                                                                 │
│          "Faça login para salvar seu histórico"                 │
│                                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Fluxo de Navegação

```text
                    ┌─────────────┐
                    │  Página     │
                    │  Inicial /  │
                    └──────┬──────┘
                           │
               "Iniciar conversa"
                           │
                           ▼
                    ┌─────────────┐
                    │   Página    │
                    │  Login      │
                    │  /login     │
                    └──────┬──────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
    [Google Login]  [Continuar sem]  [Já logado?]
            │           login             │
            ▼              │              │
     ┌──────────┐          │              │
     │ Perfil   │          │              │
     │ criado   │          │              │
     └────┬─────┘          │              │
          │                │              │
          └────────────────┼──────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │    Chat     │
                    │   /chat     │
                    └─────────────┘
```

---

## Estrutura de Banco de Dados

### Tabela: profiles

Armazena dados básicos do usuário autenticado.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | Mesmo ID do auth.users |
| email | TEXT | Email do Google |
| display_name | TEXT | Nome para exibição |
| avatar_url | TEXT | URL da foto do perfil |
| created_at | TIMESTAMP | Data de criação |
| last_seen_at | TIMESTAMP | Última atividade |

### Tabela: chat_sessions

Histórico de conversas para usuários autenticados.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | Identificador da sessão |
| user_id | UUID | Referência ao profiles |
| title | TEXT | Título gerado automaticamente |
| messages | JSONB | Array de mensagens |
| created_at | TIMESTAMP | Início da conversa |
| updated_at | TIMESTAMP | Última atualização |

### Tabela: user_roles

Controle de permissões (preparação para futuro).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | Identificador |
| user_id | UUID | Referência ao auth.users |
| role | app_role | ENUM: 'admin', 'user' |

---

## Políticas de Segurança (RLS)

### profiles
- SELECT: Usuário só vê seu próprio perfil
- UPDATE: Usuário só edita seu próprio perfil
- INSERT: Via trigger automático no signup

### chat_sessions
- ALL: Usuário só acessa suas próprias sessões

### user_roles
- SELECT: Usuário só vê suas próprias roles

---

## Componentes a Criar

### 1. Login.tsx (Página Principal)
- Design minimalista inspirado na referência
- Título "Inteligência Administrativa" centralizado
- Subtítulo com acrônimo CLARA destacado
- Botão "Entrar com Google"
- Link "Continuar sem login"
- Animações suaves com Framer Motion
- Redirecionamento automático se já logado

### 2. AuthContext.tsx
- Estado global de autenticação
- Listener para mudanças de sessão (onAuthStateChange)
- Métodos: signInWithGoogle, signOut
- Exposição de dados do usuário atual

### 3. GoogleLoginButton.tsx
- Botão estilizado para login Google
- Ícone do Google + texto
- Estados de loading

### 4. UserMenu.tsx
- Avatar do usuário + dropdown
- Opção de sair
- Exibido no header do Chat quando logado

---

## Modificações em Arquivos Existentes

### App.tsx
- Adicionar AuthProvider envolvendo toda a aplicação
- Adicionar rota /login

### HeroSection.tsx
- Botão "Iniciar conversa" redireciona para /login (em vez de /chat)

### Chat.tsx
- Adicionar UserMenu ou LoginButton no header
- Integrar com AuthContext para exibir estado do usuário

---

## Fases de Implementação

### Fase 1: Infraestrutura
1. Criar tabelas no banco (profiles, chat_sessions, user_roles)
2. Configurar triggers e funções de segurança
3. Habilitar RLS em todas as tabelas
4. Criar AuthContext.tsx

### Fase 2: Página de Login
5. Criar componente Login.tsx
6. Criar GoogleLoginButton.tsx
7. Adicionar rota /login no App.tsx
8. Atualizar HeroSection para redirecionar para /login

### Fase 3: Integração no Chat
9. Criar UserMenu.tsx
10. Atualizar header do Chat.tsx
11. Adaptar lógica de persistência (futuro: salvar no banco)

---

## Configuração Google OAuth (Sua Parte)

Você precisará configurar o Google Cloud Console. Vou guiar passo a passo:

### Passo 1: Acessar Google Cloud Console
1. Acesse: https://console.cloud.google.com/
2. Faça login com sua conta Google
3. Crie um novo projeto (ou use existente)

### Passo 2: Configurar Tela de Consentimento OAuth
1. Menu: "APIs & Services" → "OAuth consent screen"
2. Escolha "External"
3. Preencha:
   - App name: CLARA - Inteligência Administrativa
   - User support email: seu email
   - Developer contact: seu email
4. Em Scopes, adicione: email, profile, openid
5. Salve

### Passo 3: Criar Credenciais OAuth
1. Menu: "APIs & Services" → "Credentials"
2. Clique "+ CREATE CREDENTIALS" → "OAuth client ID"
3. Tipo: Web application
4. Nome: CLARA Web Client
5. Authorized JavaScript origins:
   - https://clarainova.lovable.app
   - https://id-preview--c2cb3c6c-0685-4c69-9d34-431f47c427eb.lovable.app
6. Authorized redirect URIs: (aguarde eu fornecer após configurar backend)
7. Copie o Client ID e Client Secret gerados

### Passo 4: Configurar no Lovable Cloud
Após criar as credenciais, você irá ao painel do Lovable Cloud para inserir o Client ID e Secret. Eu abrirei o painel para você quando chegarmos nessa etapa.

---

## Custos

| Item | Custo |
|------|-------|
| Google OAuth | Gratuito |
| Lovable Cloud Auth | Incluído |
| Armazenamento de dados | Incluído |
| **Total** | **R$ 0,00** |

---

## Seção Tecnica

### Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| src/pages/Login.tsx | Pagina de login minimalista |
| src/contexts/AuthContext.tsx | Contexto de autenticacao |
| src/components/auth/GoogleLoginButton.tsx | Botao de login Google |
| src/components/auth/UserMenu.tsx | Menu do usuario logado |

### Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| src/App.tsx | Adicionar AuthProvider e rota /login |
| src/components/HeroSection.tsx | CTA aponta para /login |
| src/pages/Chat.tsx | Integrar LoginButton/UserMenu no header |

### Migracoes de Banco

1. Criar enum app_role ('admin', 'user')
2. Criar tabela profiles com trigger auto-create
3. Criar tabela chat_sessions
4. Criar tabela user_roles
5. Criar funcao has_role (security definer)
6. Habilitar RLS com politicas apropriadas

### Dependencias

Nenhuma nova dependencia necessaria (Supabase Auth ja incluido).

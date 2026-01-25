

# Plano: Reorganização do Mapa do Site com Chat em Painel Lateral

## Resumo Executivo

Vamos simplificar a navegação do site integrando o chat como um **painel lateral deslizante** na página principal, eliminando a confusão entre páginas. O usuário sempre verá a CLARA enquanto conversa.

## Nova Estrutura de Navegação

```text
ANTES (confusa):
/login → / (página principal) → /chat (página separada)

DEPOIS (simplificada):
/login → / (página principal com chat integrado)
```

## Componentes Afetados

### 1. Criar: `ChatPanel.tsx`
Um novo componente que encapsula toda a interface do chat em um painel lateral usando o componente Sheet existente.

**Características:**
- Painel deslizante do lado direito
- Largura: 450px em desktop, full-screen em mobile
- Contém: header com título, área de mensagens, input de chat
- Animações suaves de entrada/saída
- Mantém todo o estado e funcionalidades do chat atual

### 2. Modificar: `Index.tsx` (Página Principal)
Integrar o ChatPanel na página principal.

**Mudanças:**
- Adicionar estado `isChatOpen` para controlar o painel
- O botão "Iniciar conversa" agora abre o painel (não navega)
- O campo de busca também abre o painel com a query
- Importar e renderizar o ChatPanel

### 3. Modificar: `HeroSection.tsx`
Adaptar os CTAs para abrir o painel em vez de navegar.

**Mudanças:**
- Receber prop `onOpenChat: (query?: string) => void`
- Botão "Iniciar conversa" → chama `onOpenChat()`
- Campo de busca submit → chama `onOpenChat(searchQuery)`
- Remover `useNavigate` e navegação para `/chat`

### 4. Modificar: `Header.tsx`
Adicionar botão de chat no header para acesso rápido.

**Mudanças:**
- Receber prop `onOpenChat: () => void`
- Adicionar ícone de chat ao lado da navegação
- Útil quando o usuário scrollou para baixo

### 5. Remover/Deprecar: `Chat.tsx`
A página separada não será mais necessária.

**Opções:**
- **Opção A**: Remover completamente
- **Opção B**: Manter como redirect para `/` (compatibilidade com links antigos)

### 6. Atualizar: `App.tsx`
Ajustar as rotas.

**Mudanças:**
- Remover ou redirecionar a rota `/chat`
- Manter todas as outras rotas iguais

### 7. Atualizar: `sitemap.xml`
Refletir a nova estrutura.

**Mudanças:**
- Remover ou marcar como redirect a URL `/chat`
- A página principal (`/`) ganha mais importância

## Fluxo de Usuário Atualizado

```text
1. Usuário acessa / (página principal)
2. Vê a Hero Section com a imagem da CLARA
3. Clica em "Iniciar conversa" ou digita no campo de busca
4. Painel lateral desliza da direita
5. Conversa acontece com a página principal visível ao fundo
6. Usuário pode fechar o painel e voltar a ver a página completa
7. Estado da conversa é preservado (localStorage)
```

## Comportamento Responsivo

| Viewport | Comportamento |
|----------|---------------|
| Desktop (>768px) | Painel lateral com 450px de largura, página visível ao fundo |
| Tablet (768px) | Painel com 400px, overlay semi-transparente |
| Mobile (<640px) | Painel full-screen para melhor usabilidade |

## Detalhes Técnicos

### Estrutura do ChatPanel

```text
ChatPanel
├── Sheet (container)
│   ├── SheetContent (side="right")
│   │   ├── Header (título + botões)
│   │   ├── Messages Area (scroll)
│   │   │   ├── Empty State (sugestões)
│   │   │   └── Message List
│   │   └── Footer (input + disclaimer)
```

### Props do ChatPanel

```typescript
interface ChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery?: string;
}
```

### Integração na Index

```typescript
const [chatOpen, setChatOpen] = useState(false);
const [initialQuery, setInitialQuery] = useState('');

const handleOpenChat = (query?: string) => {
  setInitialQuery(query || '');
  setChatOpen(true);
};
```

## Arquivos a Modificar

| Arquivo | Ação | Complexidade |
|---------|------|--------------|
| `src/components/chat/ChatPanel.tsx` | Criar | Alta |
| `src/pages/Index.tsx` | Modificar | Média |
| `src/components/HeroSection.tsx` | Modificar | Média |
| `src/components/Header.tsx` | Modificar | Baixa |
| `src/App.tsx` | Modificar | Baixa |
| `public/sitemap.xml` | Modificar | Baixa |
| `src/pages/Chat.tsx` | Avaliar remoção | Baixa |

## Benefícios

1. **Elimina confusão** - Tudo em um lugar só
2. **Experiência fluida** - Sem navegação entre páginas
3. **Contexto visual** - CLARA sempre visível
4. **Performance** - Menos carregamento de páginas
5. **Manutenção** - Menos código duplicado

## Considerações

- O histórico de chat continuará sendo salvo no localStorage
- Links diretos para `/chat` podem ser redirecionados
- A busca no Hero passa a query diretamente para o painel
- Atalhos de teclado serão adaptados (Esc fecha o painel)


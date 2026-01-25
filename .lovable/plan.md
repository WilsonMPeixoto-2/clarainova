
# Plano: Páginas de Política de Privacidade e Termos de Serviço

## Objetivo

Criar duas páginas legais profissionais para atender aos requisitos do Google OAuth:
- `/privacidade` - Política de Privacidade
- `/termos` - Termos de Serviço

Essas páginas são necessárias para que o Google valide a marca CLARA no processo de verificação OAuth.

---

## Design das Páginas

Ambas as páginas seguirão o padrão visual do projeto:
- Header e Footer consistentes com a landing page
- Design limpo e profissional (estilo LegalTech)
- Navegação clara entre seções
- SEO otimizado para cada página
- Responsivo para mobile e desktop

### Layout Proposto

```text
┌─────────────────────────────────────────────────────────────────┐
│                         HEADER                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    Política de Privacidade                      │
│                    Última atualização: [data]                   │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  1. Introdução                                            │  │
│  │  2. Dados Coletados                                       │  │
│  │  3. Uso dos Dados                                         │  │
│  │  4. Proteção dos Dados                                    │  │
│  │  5. Seus Direitos                                         │  │
│  │  6. Contato                                               │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│                         FOOTER                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Conteúdo das Páginas

### Política de Privacidade (`/privacidade`)

Abordará os seguintes tópicos:

| Seção | Conteúdo |
|-------|----------|
| Introdução | Apresentação da CLARA e compromisso com privacidade |
| Dados Coletados | Email, nome e foto do perfil Google (via OAuth) |
| Uso dos Dados | Autenticação, personalização, histórico de conversas |
| Armazenamento | Servidores seguros, criptografia |
| Compartilhamento | Declaração de não compartilhamento com terceiros |
| Seus Direitos | Acesso, correção, exclusão de dados (LGPD) |
| Cookies | Uso de cookies essenciais |
| Alterações | Política de atualização |
| Contato | Email para questões de privacidade |

### Termos de Serviço (`/termos`)

Abordará os seguintes tópicos:

| Seção | Conteúdo |
|-------|----------|
| Aceitação | Concordância com os termos ao usar o serviço |
| Descrição do Serviço | CLARA como assistente de legislação |
| Uso Permitido | Uso pessoal e profissional, não comercial |
| Responsabilidades | Limitações do serviço, disclaimer legal |
| Conta do Usuário | Responsabilidade sobre credenciais |
| Propriedade Intelectual | Direitos da CLARA sobre conteúdo |
| Limitação de Responsabilidade | Orientações não substituem assessoria jurídica |
| Modificações | Direito de alterar termos |
| Lei Aplicável | Legislação brasileira |
| Contato | Email para questões legais |

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/Privacidade.tsx` | Página de Política de Privacidade |
| `src/pages/Termos.tsx` | Página de Termos de Serviço |

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/App.tsx` | Adicionar lazy imports e rotas `/privacidade` e `/termos` |
| `src/components/Footer.tsx` | Atualizar links de âncora (`#privacidade`) para rotas reais (`/privacidade`) |

---

## Links para o Google OAuth

Após a implementação, você poderá usar estes links no Google Cloud Console:

- **Página inicial**: `https://clarainova.lovable.app`
- **Política de Privacidade**: `https://clarainova.lovable.app/privacidade`
- **Termos de Serviço**: `https://clarainova.lovable.app/termos`

---

## Seção Técnica

### Estrutura dos Componentes

Cada página seguirá esta estrutura:
- SEOHead para metadados e indexação
- Header (reutilizado)
- Conteúdo com seções e ancoras internas
- Footer (reutilizado)

### Padrões Aplicados

- Lazy loading das páginas (consistente com outras rotas)
- Animações suaves com Framer Motion
- Scroll suave para navegação entre seções
- Links de retorno ao topo
- Data de última atualização automática

### Dependências

Nenhuma nova dependência necessária.

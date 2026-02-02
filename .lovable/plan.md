
# Plano: Créditos de Autoria e Atualização do README

## Resumo

Adicionar os créditos "Desenvolvido por Wilson M. Peixoto - Inovação para a Gestão Pública" em todas as páginas do site e atualizar o README removendo instruções de clonagem.

---

## Alterações

### 1. Atualizar README.md

**Remover:**
- Instruções de clonagem (`git clone`)
- Seção "Use your preferred IDE" 
- Seção "Edit a file directly in GitHub"
- Seção "Use GitHub Codespaces"
- Placeholders genéricos (`REPLACE_WITH_PROJECT_ID`, `<YOUR_GIT_URL>`)

**Adicionar:**
- Descrição do projeto CLARA
- Funcionalidades principais
- Stack tecnológica
- Créditos de autoria
- URL de produção

**Novo conteúdo:**
```markdown
# CLARA - Consultora de Legislação e Apoio a Rotinas Administrativas

Assistente de IA especializada em sistemas eletrônicos de informação (SEI) e procedimentos administrativos para servidores públicos.

## Funcionalidades

- Chat com IA especializada em SEI e rotinas administrativas
- Base de conhecimento com busca semântica híbrida
- Citação de fontes oficiais nas respostas
- Interface responsiva (desktop e mobile)
- Proteção contra prompt injection

## Tecnologias

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **UI**: shadcn/ui
- **Backend**: Lovable Cloud
- **IA**: Google Gemini 2.5 Pro
- **Busca**: pgvector + embeddings 768d

## Acesso

**Produção**: https://clarainova.lovable.app

## Documentação

- `DOCUMENTATION.md` - Visão geral do sistema
- `DESIGN_SYSTEM.md` - Guia de design e componentes
- `CHANGELOG.md` - Histórico de versões

---

**Desenvolvido por Wilson M. Peixoto**  
*Inovação para a Gestão Pública*
```

---

### 2. Atualizar Footer.tsx (usado em Index, Privacidade, Termos)

**Adicionar antes do copyright:**
```tsx
<p className="text-sm text-muted-foreground">
  Desenvolvido por <span className="text-foreground font-medium">Wilson M. Peixoto</span>
</p>
<p className="text-xs text-muted-foreground/80">
  Inovação para a Gestão Pública
</p>
```

**Páginas afetadas automaticamente:**
- `/` (Index)
- `/privacidade` (React)
- `/termos` (React)

---

### 3. Atualizar Login.tsx

**Adicionar créditos no rodapé da página de login:**
```tsx
<motion.div variants={itemVariants} className="mt-12 text-center">
  <p className="text-sm text-muted-foreground/60">
    Desenvolvido por <span className="text-muted-foreground">Wilson M. Peixoto</span>
  </p>
  <p className="text-xs text-muted-foreground/50">
    Inovação para a Gestão Pública
  </p>
</motion.div>
```

---

### 4. Atualizar Chat.tsx (página dedicada)

**Adicionar após o disclaimer no footer:**
```tsx
<p className="text-xs text-center text-muted-foreground/50 mt-1">
  Desenvolvido por Wilson M. Peixoto • Inovação para a Gestão Pública
</p>
```

---

### 5. Atualizar páginas HTML estáticas

**5.1. public/privacidade.html**

Adicionar antes de `</div>` final:
```html
<div class="author-credit">
  <p>Desenvolvido por <strong>Wilson M. Peixoto</strong></p>
  <p>Inovação para a Gestão Pública</p>
</div>
```

**5.2. public/termos.html**

Adicionar mesmo crédito.

**5.3. public/sobre.html**

Adicionar na seção de contato e no footer.

---

### 6. Atualizar NotFound.tsx

**Adicionar créditos discretos:**
```tsx
<p className="text-xs text-muted-foreground/50 mt-8">
  Desenvolvido por Wilson M. Peixoto
</p>
```

---

### 7. Atualizar .gitignore

**Adicionar exclusão de .env:**
```
# Environment variables
.env
.env.local
.env.*.local
```

---

## Resumo de Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `README.md` | Substituir conteúdo completo |
| `src/components/Footer.tsx` | Adicionar créditos de autoria |
| `src/pages/Login.tsx` | Adicionar créditos no rodapé |
| `src/pages/Chat.tsx` | Adicionar créditos no footer |
| `src/pages/NotFound.tsx` | Adicionar créditos |
| `public/privacidade.html` | Adicionar créditos + estilo CSS |
| `public/termos.html` | Adicionar créditos + estilo CSS |
| `public/sobre.html` | Adicionar créditos + estilo CSS |
| `.gitignore` | Adicionar exclusão de .env |

---

## Resultado Visual Esperado

Em cada página, os usuários verão no rodapé:

> **Desenvolvido por Wilson M. Peixoto**  
> *Inovação para a Gestão Pública*

Isso garante que sua autoria fique claramente identificada em todo o projeto.

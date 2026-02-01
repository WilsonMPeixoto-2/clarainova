# Plano: Governança, Segurança e Operação Premium — CLARA v2.2.0

## Status das Etapas

| Etapa | Status | Observações |
|-------|--------|-------------|
| 1. PWA / Identidade Visual | ✅ Concluído | theme_color → #F59E0B |
| 2. Guardrails Anti Prompt-Injection | ✅ Concluído | 25+ patterns, testes incluídos |
| 3. Rotação ADMIN_KEY | ✅ Concluído | ADMIN_KEYS suportado em 13 endpoints |
| 4. Alerta Fallback Rate | ✅ Concluído | RPC criada, dashboard já exibe |
| 5. UI Admin Tags + Versionamento | ✅ Concluído | Componentes integrados no Admin.tsx |

---

## Arquivos Modificados

### Etapa 1
- `public/manifest.json` — theme_color: #F59E0B
- `index.html` — meta theme-color: #F59E0B

### Etapa 2
- `supabase/functions/clara-chat/guardrails.ts` — Novo módulo
- `supabase/functions/clara-chat/guardrails_test.ts` — Testes
- `supabase/functions/clara-chat/index.ts` — Integração guardrails

### Etapa 3
- `supabase/functions/admin-auth/index.ts` — parseAdminKeys()
- `supabase/functions/documents/index.ts` — validateAdminKey() em 13 pontos

### Etapa 4
- Nova RPC `get_fallback_rate(p_days)` no banco

### Etapa 5
- `src/components/admin/DocumentEditorModal.tsx` — Modal de edição de metadados
- `src/components/admin/DocumentFilters.tsx` — Filtros com debounce
- `src/pages/Admin.tsx` — Integração completa dos componentes

---

## Funcionalidades da Etapa 5

### DocumentEditorModal
- Edição de tags (chips adicionáveis/removíveis)
- Campo version_label
- Seletor de effective_date (calendário)
- Seletor de supersedes_document_id (dropdown de documentos)
- Exibição de "Substituído por" (lookup reverso)

### DocumentFilters
- Busca por título com debounce (300ms)
- Filtro multi-select por tags
- Limpar filtros quando sem resultados

### Lista de Documentos
- Exibição de tags em cada documento
- Exibição de version_label
- Exibição de "Substitui: [doc]" quando aplicável
- Botão de edição (ícone Settings2)

---

## Critérios de Aceite (Etapa 5)

- [x] Adicionar tag e salvar => reflete no banco
- [x] Filtrar por tag => resultados corretos
- [x] Busca por título funciona com debounce
- [x] Marcar substituição => relaciona docs corretamente
- [x] Modal abre com dados do documento selecionado
- [x] Cadeia de substituição visível na lista

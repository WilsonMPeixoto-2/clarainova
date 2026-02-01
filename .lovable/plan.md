# Plano: Governança, Segurança e Operação Premium — CLARA v2.2.0

## Status das Etapas

| Etapa | Status | Observações |
|-------|--------|-------------|
| 1. PWA / Identidade Visual | ✅ Concluído | theme_color → #F59E0B |
| 2. Guardrails Anti Prompt-Injection | ✅ Concluído | 25+ patterns, testes incluídos |
| 3. Rotação ADMIN_KEY | ✅ Concluído | ADMIN_KEYS suportado em 13 endpoints |
| 4. Alerta Fallback Rate | ✅ Concluído | RPC criada, dashboard já exibe |
| 5. UI Admin Tags + Versionamento | 🟡 Parcial | Componentes criados, integração pendente |

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
- `src/components/admin/DocumentEditorModal.tsx` — Novo
- `src/components/admin/DocumentFilters.tsx` — Novo

---

## Próximos Passos (Etapa 5 - Pendente)

1. Importar componentes no Admin.tsx
2. Adicionar estado para document em edição
3. Integrar filtros na listagem de documentos
4. Testar fluxo completo de edição de tags

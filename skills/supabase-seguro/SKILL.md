---
name: supabase-seguro
description: Usa Supabase com RLS, Auth, schema e Edge Functions sob menor privilégio.
categoria: Backend
---
# Supabase Seguro
- Preserve dados existentes.
- Faça DDL por migrations rastreáveis.
- Não execute DROP/TRUNCATE sem autorização.
- Revise índices para filtros e joins frequentes.
- Mantenha RLS em tabelas expostas ao cliente.
- Policies devem aplicar menor privilégio.
- Nunca exponha `service_role` no navegador.
- Secrets pertencem ao servidor.
- Valide entradas de Edge Functions e mantenha `verify_jwt` por padrão.
- Após mudanças relevantes, revise advisors de segurança/performance.

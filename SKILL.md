---
name: testes-regressao
description: Checklist de validação antes de considerar uma alteração concluída.
categoria: Qualidade
---
# Testes e Regressão
1. Execute build/typecheck/lint disponíveis.
2. Confirme a rota/feature alterada.
3. Teste estado inicial, loading, sucesso, erro e vazio.
4. Verifique teclado e mobile.
5. Revise console errors e requests inesperadas.
6. Confirme que funcionalidades vizinhas não foram alteradas.
7. Para Supabase, valide RLS/policies e logs quando houver mudança backend.
8. Informe qualquer validação que não pôde ser executada.

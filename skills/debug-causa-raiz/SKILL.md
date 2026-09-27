---
name: debug-causa-raiz
description: Investiga bugs por evidência antes de alterar código.
categoria: Qualidade
---
# Debug por Causa Raiz
1. Reconstrua o fluxo exato do erro.
2. Identifique entrada, estado, request, persistência e saída.
3. Ache o primeiro ponto em que o comportamento diverge.
4. Use logs quando ajudarem a confirmar a hipótese.
5. Corrija a causa, não apenas o sintoma.
6. Evite retries e timeouts genéricos sem diagnóstico.
7. Considere corrida, stale state, cache e timezone.

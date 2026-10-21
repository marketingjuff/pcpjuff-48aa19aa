# Controle de Perdas (COP): Área do erro real e Motivo correto nas linhas PCP

Só exibição e o campo enviado ao reclassificar. Nada de migração, SQL ou alteração de dados. Só 3 arquivos.

## Parte 1 — Área do erro (regra única)
`area_erro ?? (erro_producao ? "Produção" : "—")`

### src/components/cop/ControlePerdasTab.tsx
- Ordenação `area`: `p.area_erro ?? (p.erro_producao ? "Produção" : "")` (só PCP).
- Variável `areaErro` nas linhas: mesma regra com "—" (só PCP).

### src/components/cop/PerdaDetalheDialog.tsx
- Row "Área do erro": mesma regra; condição em volta não muda.

### src/components/cop/CorrigirPerdaDialog.tsx
- Texto "Área original": mesma regra com "—".
- `area_erro_original` no salvar: fallback final `null` (afeta só reclassificações novas).

## Parte 2 — Motivo nas linhas PCP (ControlePerdasTab.tsx)
- Função `motivoDe(p)` no escopo do módulo: PCP usa `problema`, se vazio cai para `motivo`; demais origens usam `motivo`.
- Aplicada nos 5 pontos: opções do filtro, aplicação do filtro, card "Motivo com mais perdas", ordenação e célula da coluna.
- Rótulo, ordem de colunas, colSpan e demais filtros não mudam.

## Parte 3 — Popup de detalhe (PerdaDetalheDialog.tsx)
- Row "Motivo" passa a "Observações" quando origem PCP. Row "Problema" e bloco "Histórico — Reclassificada" não mudam.

## Conferência
Typecheck e diff entregue. Nenhum outro arquivo tocado.

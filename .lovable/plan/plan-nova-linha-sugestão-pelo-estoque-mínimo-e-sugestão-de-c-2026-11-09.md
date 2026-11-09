# PLAN — Nova linha "Sugestão pelo estoque mínimo" e Sugestão de corte sem destaque

Mudança só de frontend, sem migração. Allowlist estrita: `src/lib/plan.ts` e `src/components/plan/NecessidadeTab.tsx`.

## 1. `src/lib/plan.ts` — somente adição de campo

- Na interface `LinhaNecessidade`, adicionar:
  ```ts
  /** firme + o que falta para chegar no mínimo adotado, por tamanho (só exibição) */
  sugestaoMinimoPorTam: Record<string, number>;
  ```
- Em `montarNecessidade`, no laço por tamanho (onde já existem `firme` e `faltaParaMinimo`, linhas ~705-714):
  - declarar `const sugestaoMinimoPorTam: Record<string, number> = {};` junto dos outros records;
  - preencher `sugestaoMinimoPorTam[t] = foraDeLinha ? 0 : firme + faltaParaMinimo;`;
  - incluir no `out.push`.
- Em `aplicarPausas` (linhas ~856-869), no objeto da linha pausada, sobrescrever `sugestaoMinimoPorTam` com o mesmo valor usado em `aProduzirPorTam` ali (só o firme, ou zero se fora de linha), para a linha do mínimo mostrar apenas peça já vendida.
- PROIBIDO alterar `aProduzirPorTam`, `aProduzir`, `porMinimoPorTam`, `porMinimo`, `diasRuptura` ou qualquer campo existente — a aba "O que mandar tingir" depende deles.

## 2. `src/components/plan/NecessidadeTab.tsx`

- Trocar os 6 `rowSpan={3}` da primeira linha do bloco (Modelo, Cor, Total, Já vendido, Situação, Ações) por `rowSpan={4}`.
- Sublinha "Sugestão de corte" (linhas ~374-386):
  - rótulo passa a `text-xs text-muted-foreground` (igual a "Pronto em estoque"/"Em produção");
  - células passam a `text-xs text-muted-foreground tabular-nums`, sem `font-semibold`/`font-extrabold`;
  - manter fundo âmbar e o texto "X em falta" exatamente como hoje;
  - remover o `border-b` da `<tr>` (deixa de ser a última do bloco).
- Nova sublinha "Sugestão pelo estoque mínimo", logo abaixo, com `border-b` e a mesma alternância de fundo (`index % 2`):
  - rótulo em `font-semibold` (como a Sugestão de corte é hoje);
  - valor por tamanho: `l.sugestaoMinimoPorTam[t] ?? 0`, com o mesmo teste de catálogo (`catalogo[l.modelo]?.tamanhos.includes(t) ? valor : "—"`);
  - valor > 0 em `font-semibold`; valor 0 em `text-muted-foreground/40`.
- Não mexer na coluna Total, nos selos "piso do mínimo"/"Só pedido vendido", nos cards do topo nem nos filtros.
- No bloco de legenda do rodapé, acrescentar:
  > **Sugestão pelo estoque mínimo**: peça já vendida em falta mais o que falta para o estoque chegar no mínimo adotado na aba Estoque mínimo. Não considera a previsão de venda.

## Verificação (sem gravar dados)

- Typecheck (`oj typecheck -b --noEmit`) e testes existentes (`bun test` nos testes do PLAN) — mostrar o resultado.
- Conferência visual com Playwright (sessão admin já disponível): bloco com 4 sublinhas na ordem correta, Sugestão de corte sem negrito, nova linha em negrito, números da Sugestão de corte idênticos aos de antes, aba Tinturaria inalterada.
- Diff final em `/mnt/documents/`.

## Critérios de aceite (do documento)

1. 4 sublinhas por bloco: Pronto em estoque, Em produção, Sugestão de corte, Sugestão pelo estoque mínimo.
2. As três primeiras com mesmo tamanho/cor de texto, sem negrito.
3. Sugestão pelo estoque mínimo em negrito.
4. Números da Sugestão de corte idênticos aos de antes.
5. Cor com mínimo 0 em todos os tamanhos: nova linha mostra só peças já vendidas em falta.
6. Aba "O que mandar tingir" com os mesmos números.
7. Colunas fixas ocupam o bloco inteiro (rowSpan 4), sem célula sobrando ou faltando.
8. Nenhuma migração; nenhum arquivo fora da allowlist.

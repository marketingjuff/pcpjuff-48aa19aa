# Plano: Proteção contra fórmulas nos CSVs exportados

Objetivo: neutralizar textos digitados que começam com `=`, `+`, `-`, `@`, tab ou `\r` nos dois CSVs exportados, prefixando com apóstrofo `'` antes das aspas. Números, moedas, percentuais, dias e datas não recebem apóstrofo. Nenhuma migração, nenhum outro arquivo tocado.

## 1. `src/components/sup/EconomiaTrocaTab.tsx`

- Criar função local `celTexto(v: string): string`: se `v` começar com `=`, `+`, `-`, `@`, `\t` ou `\r`, prefixa com `'`; depois envolve em aspas duplas e duplica aspas internas (`"` → `""`).
- Criar função local `celNum(v: string): string`: só envolve em aspas e duplica aspas internas (sem apóstrofo).
- Em `exportarCsv()`:
  - Cabeçalho: cada título passa por `celNum`.
  - Corpo: `l.pc`, `l.grupo`, `l.fornecedorAnterior ?? "—"`, `l.fornecedorAtual` passam por `celTexto`; data, preços, variação %, quantidade e economia passam por `celNum`.
  - Montagem vira `[cab, ...linhasCsv].map((r) => r.join(";")).join("\r\n")` mantida, mas sem aspas manuais (as funções já devolvem a célula pronta).
- Intocados: separador `;`, quebra `\r\n`, BOM `\uFEFF`, nome do arquivo, ordem das colunas, função `num()` e todos os cálculos.

## 2. `src/components/pcp/IndicadorDrillDialog.tsx`

- `csvEscape` vira `csvEscape(v: string, texto = false)`: quando `texto` é `true`, aplica a neutralização (apóstrofo se começar com `=`, `+`, `-`, `@`, `\t` ou `\r`) antes das aspas; o escape de aspas atual continua igual.
- Em `baixarCsv()`: células do corpo passam `c.tipo === "texto"` como segundo argumento. Cabeçalho continua `csvEscape(c.label)` sem neutralização.
- Intocados: `formatCelula`, separador `;`, BOM, nome do arquivo, quebras `\n` e a tabela na tela.

## Verificação

- `oj typecheck -b --noEmit` (sem erros).
- Conferência do diff: apenas os dois arquivos da allowlist; `package.json` intacto; nenhuma migração criada.
- Não marco o aviso como resolvido no scanner (você faz manualmente).
- Não testo a exportação na tela (preview grava no banco de produção; e a mudança só afeta o arquivo baixado).

## Critérios de aceite cobertos

1. `=HYPERLINK("http://x","clique")` sai como `"'=HYPERLINK(""http://x"",""clique"")"`.
2. `;` no nome não desloca colunas (aspas em todas as células).
3. `-12,50` em Economia R$ sai sem apóstrofo (vai por `celNum`).
4. Nome de cliente começando com `+` ou `@` no detalhamento sai com apóstrofo; moeda/número/perc/dias/data inalterados.
5. Tela das duas abas inalterada.
6. Diff restrito aos dois arquivos.

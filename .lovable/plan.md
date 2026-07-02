# Reformular a aba "Oficinas Hoje" (COP)

Objetivo: transformar a tabela hierárquica atual em uma tabela achatada compacta, uma linha por cor, com chip colorido, colunas de tamanho dinâmicas, grupo "Em corte" no topo, subtotais por grupo e Total geral fixo no rodapé.

Mudança 100% front-end. Sem migração. `cop-saldos.ts` intocado. Nada do PCP alterado.

## Arquivos alterados

- `src/lib/cop-oficinas.ts` — aditivo (novas funções)
- `src/components/cop/OficinasHojeTab.tsx` — reescrito

## `src/lib/cop-oficinas.ts` (aditivo)

Extrair a rotina interna de agrupamento `COP → Modelo → Cor` de `arvoreOficinasHoje` para uma helper privada `_agruparCopsEmNos(cops: Cop[]): NoCop[]`, mantendo `arvoreOficinasHoje` com output idêntico. Adicionar:

- `nosEmCorte(cops): NoOficina | null` — filtra COPs com `status ∈ STATUS_CORTE` (sem `oficina_id`), usa a oficina sintética `{ id: "__corte__", nome: "Em corte" }`. Retorna `null` se vazio.
- `arvoreProducaoHoje(cops, oficinas): NoOficina[]` — `[grupoEmCorte?, ...arvoreOficinasHoje(cops, oficinas)]`.
- `subtotaisPorTamanho(no, tamanhos): Record<string, number>` — soma por tamanho no grupo (percorre cops → modelos → cores → porTamanho).
- `totaisGeraisPorTamanho(nos, tamanhos): Record<string, number>` — soma dos subtotais.
- `tamanhosVisiveis(nos): string[]` — coleta tamanhos com qtd > 0 em toda a árvore; ordena por índice em `REFACAO_TAMANHOS`, extras alfabéticos ao fim; fallback: `REFACAO_TAMANHOS` inteiro.

## `src/components/cop/OficinasHojeTab.tsx` (reescrito)

Layout achatado: uma linha por cor. Colunas: `Oficina | COP | Modelo | Cor | <tamanhos dinâmicos> | Total`.

- Supressão visual: comparar com a linha anterior; se `oficinaId/copId/modelo` iguais, deixar a célula em branco (sem `rowspan`).
- Coluna Cor: chip com `corHex`/`corTextoSobre` (importados de `@/components/pcp/PecasPerdidasEditor`).
- Grupo "Em corte" sempre primeiro, com badge pequeno "não enviado" em amarelo (tokens já usados no projeto). Rótulo do grupo: "Em corte".
- Chevron apenas no nível de grupo (oficina/Em corte). Remover chevrons de COP e Modelo. Recolhido → mostra só a linha `Total <Nome>`. Expandido → linhas de cor + `Total <Nome>`.
- Subtotal por grupo: linha `Total <Nome>` com fundo `bg-muted/60`, com valores por tamanho (via `subtotaisPorTamanho`) e total.
- Total geral: linha final `sticky bottom-0`, fundo verde suave (`#9FE1CB`), célula do total em `#5DCAA5`, texto `#04342C`, borda superior `1.5px solid #1D9E75`. Somatórios via `totaisGeraisPorTamanho`.
- Cabeçalho segue `sticky top-0`.
- Densidade compacta: `text-[12.5px]`, `leading-[1.2]`, padding vertical ~4px, números `text-right tabular-nums`, células vazias com `–` em `text-muted-foreground`.
- Manter botões Recarregar / Expandir tudo / Recolher tudo (agora agindo só nos grupos), o `useQuery` de `cops` e `oficinas`, e o canal realtime.
- Contagem no topo: `N oficinas · N romaneios · N peças` (incluir grupo Em corte na contagem de romaneios/peças).

## Layout esquemático

```text
Oficina  COP    Modelo   Cor         PP  P  M  G  GG  Total
──────────────────────────────────────────────────────────────
Em corte 0012A  Camiseta  Preto       –   4  6  2  –     12
                          Branco      –   –  3  1  –      4
                 Regata   Preto       –   2  –  –  –      2
Total Em corte                        –   6  9  3  –     18
──────────────────────────────────────────────────────────────
Fabiana  0011   Camiseta  Preto       –   5 10  4  1     20
         0013A  Camiseta  Verde       –   2  4  –  –      6
Total Fabiana                         –   7 14  4  1     26
──────────────────────────────────────────────────────────────
[sticky] Total geral                  –  13 23  7  1     44
```

## Verificação

- `bun run build` (typecheck estrito).
- Preview: expandir/recolher grupos, conferir chip colorido, sumiço de PP quando zerado, Total geral fixo ao rolar.

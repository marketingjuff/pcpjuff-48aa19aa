# SUP — correções na tela de conferência da NF-e

Três arquivos, nada fora da allowlist. O preço continua sendo o unitário da nota;
a mudança é de clareza, unidades e ergonomia.

## Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/migrations/<ts>_seed_sup_unidades.sql` | criar — seed aditivo em `app_lists` |
| `src/lib/nfe-xml.ts` | editar — só `DE_PARA_UNIDADE` |
| `src/components/sup/ImportarXmlProdutosDialog.tsx` | editar |

Nenhum outro arquivo é tocado. Sem dependência nova.

## 1. Migração — unidades em `app_lists`

`INSERT ... SELECT ... WHERE NOT EXISTS` para as 8 base (unidade, peça, kg, litro,
metro, rolo, caixa, pacote) **mais** galão, balde, frasco, lata, saco e bobina,
com `kind = 'sup_unidade'` e `ordem` 10..140. Idempotente. Sem DROP/DELETE/UPDATE/TRUNCATE
e sem mudança de schema.

Semear as 8 base é necessário porque `ProdutosTab` usa `unidadesLista.length ? unidadesLista : SUP_UNIDADES`
— inserir só as novas faria as originais desaparecerem do dropdown.

## 2. `src/lib/nfe-xml.ts`

Somente a constante `DE_PARA_UNIDADE`:

- acrescenta GL/GAL/GALAO/GALÃO → `galão`; BD/BALDE → `balde`; FR/FRASCO → `frasco`;
  LATA → `lata`; SC/SACO/SACA → `saco`; BB/BOB/BOBINA → `bobina`;
- remove `LT` do mapeamento de `litro` (ambíguo com "lata" — NF 1096, vedante 900 ml);
  ficam `L`, `LITRO`, `LITROS`.

`mapearUnidadeNFe`, `parseNFe`, `cfopEhCompra`, `rotuloCfop`, `condicaoPagamentoNFe`
e `normalizarNome` seguem intactas, inclusive o retorno `""` quando a unidade não
existir na lista configurada.

## 3. `ImportarXmlProdutosDialog.tsx`

**Preço unitário claro**
- cabeçalho "Preço NF" → "Preço unit.", com `title` "Preço de uma unidade, conforme o valor unitário da nota".
- `preco` da linha inicializado formatado em pt-BR com 2 casas (em vez de `String(item.vUnCom)`).
- na coluna Qtd, quando `qtd > 1`, linha auxiliar `text-[10px] text-muted-foreground`
  com `2 × 1.113,10 = 2.226,20`, recalculada a partir do valor atual do campo.
- input de preço sem spinner, aceitando vírgula; leitura para gravar continua pelo
  `n()` de `src/lib/sup.ts` (troca os `l.preco.replace(",", ".")` por `n(l.preco)`).

**Preenchimento em massa** — faixa acima da tabela com três seletores (Unidade,
Departamento, Grupo) usando as props já existentes. Cada um com dois botões:
"Preencher vazias" (só linhas marcadas com o campo vazio) e "Aplicar em todas"
(todas as marcadas). Nenhuma query nova.

**Sigla original** — quando a unidade da linha estiver vazia, badge cinza
(`BADGE_SM_CLASS`) ao lado do Select com o `uCom` cru da nota (ex.: `lt`).

**Bloqueio amigável** — se houver linha marcada sem unidade: "Importar selecionados"
desabilitado, aviso âmbar acima ("N linha(s) marcada(s) sem unidade. Preencha a
unidade para continuar.") e `ring-1 ring-amber-400` nas linhas problemáticas.
Departamento e grupo continuam opcionais.

Casamento por `cod_fornecedor` → nome, filtro de CFOP, `aplicarPrecoTabela` e o
restante do fluxo de gravação permanecem idênticos.

# COP — Estoque Real Multi-Empresa (2 abas novas)

Trabalho 100% aditivo. Nenhuma aba, cálculo ou arquivo existente do COP muda, exceto o registro das duas abas em `cop.tsx`.

## 1. Migração SQL (somente aditiva)

Três tabelas novas, no padrão do projeto (GRANT para `authenticated` + `service_role`, RLS ligada, policies via `has_role`):

- **`estoque_olist_snapshots`** — `empresa` ('JOKE'/'JUFF'), `arquivo_nome`, `importado_em`, `importado_por`, `total_linhas`, `linhas_ignoradas jsonb`.
- **`estoque_olist_itens`** — `snapshot_id` (FK → snapshots, on delete cascade), `empresa`, `produto_olist`, `cor`, `tamanho`, `qtd`.
- **`olist_produto_map`** — `produto_olist` (unique), `modelo_cop`, `criado_em`, `criado_por`.

Acesso: leitura para admin ou gestor; escrita (importar/mapear) para admin ou gestor. Sem policies de DELETE (snapshots são histórico e não se apagam). Nenhum DROP, TRUNCATE ou alteração de tabela existente.

## 2. Dependência

Adicionar `xlsx` (SheetJS) — lê `.xls` BIFF, `.xlsx` e `.csv` no client.

## 3. Helper novo — `src/lib/estoque-olist.ts`

- Tipos (`EmpresaOlist`, `ItemOlist`, `LinhaIgnorada`, `ResultadoParse`).
- `parsePlanilhaOlist(file)`: SheetJS → linhas → usa só `Produto` e `Estoque atual`.
- `parseProduto(str)`: split por `" - "`; último token = tamanho (validado contra `REFACAO_TAMANHOS`), penúltimo = cor, resto rejuntado com `" - "` = `produto_olist`. Último token inválido → entra em `linhas_ignoradas` (não trava).
- `normalizarCor(cor)`: casa com `REFACAO_CORES` ignorando acentos e caixa; sem match, mantém o texto da planilha.
- `agregarItens(itens)`: soma `qtd` por `produto_olist·cor·tamanho`.
- Nada de `cop-saldos.ts` é modificado; apenas importado onde necessário.

## 4. Aba "Alimentação Estoque Real" — `AlimentacaoEstoqueTab.tsx`

- Topo: destaque da data/hora da última atualização geral + aviso se alguma empresa nunca foi importada.
- Dois cards lado a lado (JOKE / JUFF): dropzone + botão de arquivo, data/hora e nome do arquivo da última importação daquela empresa. Sugestão de empresa pelo nome do arquivo, mas o card onde o arquivo foi solto é o que vale.
- Ao subir: parse → agrega → insere snapshot + itens → toast com linhas lidas, combinações agregadas e linhas ignoradas (lista das ignoradas visível).
- **Produtos pendentes de mapeamento:** todos os `produto_olist` dos snapshots mais recentes das duas empresas sem linha em `olist_produto_map`; select com `REFACAO_MODELOS` + salvar. Badge de alerta com a contagem. Lista secundária de já mapeados, com edição (update de 1 linha).
- Prévia por empresa: tabela agregada (produto · cor · tamanho · qtd) com busca e cabeçalho congelado.

## 5. Aba "Saldo Real Juff" — `SaldoRealTab.tsx`

Somente leitura, automática. Fontes:

1. Snapshot mais recente de cada empresa, itens já mapeados para modelo COP (não mapeados ficam de fora, com aviso).
2. Saldo da aba Disponível, recalculado com as mesmas funções de `cop-saldos.ts` (`calcEmProducao`, `calcFaltantes`, `calcRecebido`, `calcPerdas`, `calcDisponivel`, `pkKey`) e as mesmas queries de `cops`/`pedidos` + realtime.

```text
Saldo Multi-Empresa = qtd JOKE + qtd JUFF
Saldo Real          = Saldo Multi-Empresa + Saldo Disponível
```

- Tabela Modelo · Cor com colunas por tamanho na ordem de `REFACAO_TAMANHOS`, visual no padrão da Disponível, cabeçalho congelado `max-h-[70vh]`.
- Célula mostra o Saldo Real; clique abre popup com JOKE, JUFF, Multi-Empresa, Disponível e Saldo Real.
- Filtros: modelo, cor, toggle "apenas negativos". Negativos em vermelho. Ordenação canônica de modelo/cor.

## 6. Registro das abas

Em `src/routes/_authenticated/cop.tsx`: duas entradas em `BASE_TABS` (`alimentacao-estoque`, `saldo-real`) logo após "Disponível", e dois `TabsContent forceMount hidden` no padrão dos demais. Nenhuma outra linha do arquivo é tocada.

## Fora de escopo / proibido tocar

`src/lib/cop-saldos.ts`, `src/components/cop/DisponivelTab.tsx`, e qualquer outro arquivo de PCP, COP ou MAP.

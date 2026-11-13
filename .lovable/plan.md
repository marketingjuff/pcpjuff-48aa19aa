# Refação com vários motivos no mesmo lançamento

Sem migração, sem SQL. Só os 10 arquivos da allowlist; protegidos intactos (incluindo `IdentificacaoErroCampos.tsx`, só reutilizado).

## 1. `src/lib/pedidos.ts`
- Novo tipo `RefacaoBloco` exatamente como no pedido.
- `RefacaoEpisodio.blocos?: RefacaoBloco[]` (opcional).
- Novo `blocosDoEpisodio(ep)`: devolve `ep.blocos` se tiver itens; senão um bloco sintético com os campos de topo (`?? ""`, `?? 0`, `?? []`). Nunca vazio. Sem fallback de `area_identificou` dentro dele.
- Nenhuma função existente muda.

## 2. `src/components/pcp/RefacaoDialog.tsx`
- Parte A (topo): "Qual área identificou o problema?".
- Parte B: lista de blocos em estado (`BlocoEstado[]`), cada um renderizado pelo subcomponente `BlocoMotivoCampos` (no mesmo arquivo; hooks só dentro dele). Card "Motivo N" com: dentro da Juff, área, problema, `OficinaBercoCampos`, peças a refazer (mín. 1), perda de peças + `PecasPerdidasEditor`, perda de adesivos (regra abaixo). Lixeira só com 2+ blocos; botão "+ Adicionar outro motivo".
- Subcomponente informa ao pai `pedeBerco` e `bercosLista` via callback (guardado por índice).
- Regra do adesivo: aparece só com DTF e se nenhum bloco anterior estiver "Sim". Quando um bloco vira "Sim", os seguintes são zerados (resposta e quantidade em branco); ao voltar para "Não", reaparecem em branco e obrigatórios. Bloco sem a pergunta grava `perda_adesivos: 0`.
- Parte C (fim): "Faltou adesivo?" com aviso amarelo e regra de destino Arte (sem mudança) + Observações.
- Validação: mesmas mensagens por bloco; com 2+ blocos, prefixo "Motivo N. ". Erro no mesmo lugar de hoje.
- Payload: `RefacaoFormPayload.blocos`; topo = somas (peças a refazer, perdidas, adesivos), `pecas_perdidas` concatenado em ordem, identificação do bloco 1, parte geral como hoje. Com 1 bloco o topo fica idêntico ao atual.
- Ao abrir/fechar, reinicia com um bloco vazio.

## 3. `src/components/pcp/refacao-helpers.ts`
- Em `montarRefacoesAposRefazer`, episódio novo recebe `blocos: payload.blocos`. Nada mais.

## 4. `src/lib/perdas-consolidado.ts` (Fonte C)
- Itera `blocosDoEpisodio(ep)` e depois `bloco.pecas_perdidas`; área, dentro/fora, problema, oficina e berço do bloco; identificou e motivo do episódio.
- `itemIdx` corrido entre blocos (ids e `fonte` de episódios antigos iguais aos de hoje).
- Reclassificação: saldo por chave (episódio + modelo/cor/tamanho), consumido em ordem, para não deduzir duas vezes.
- Ponto de atenção: um episódio antigo que já tenha a mesma peça repetida em duas linhas hoje sofre a dedução duas vezes; com o saldo passa a ser deduzida uma vez só. Considero isso uma correção. Se preferir manter o antigo idêntico, aplico o saldo só a episódios com `blocos`.

## 5. `src/lib/kpi-pcp.ts` (laço ~696)
- Por bloco: área = `bloco.area_erro || e.area_identificou || "—"`; soma peças/perdidas do bloco; `episodios` +1 por área distinta da refação; uma linha de drill por bloco. Totais gerais inalterados.

## 6. `src/lib/indicadores-olist.ts` (~879)
- Mesma regra do item 5 em `refacoesPorArea`.

## 7. `src/lib/indicadores-drill.ts` (~698)
- Uma linha por bloco com colunas do bloco; `falta_adesivos`/`qtd_falta_adesivos` só na primeira linha ("—" e 0 nas demais); filtros por área e `modo === "perdidas"` por bloco.

## 8. `src/components/pcp/RetrabalhoTab.tsx`
- `problemaCount`, `areaErroCount`, `problemaUlt30` por bloco (distintos por refação contam uma vez). Totais de peças/adesivos pelo topo.
- `EpisodioCard`: com 2+ blocos, seção por bloco "Motivo N" (dentro da Juff, área, problema, peças a refazer, perdidas, adesivos). Com 1 bloco, tela atual.

## 9. `src/components/pcp/RefacaoViewerButton.tsx`
- 2+ blocos: cada "Motivo N" com área, problema, oficina, berço, peças a refazer, adesivos e peças perdidas; identificado por, falta de adesivo e observações uma vez só.
- "Editar peças perdidas" por bloco quando há `blocos`: grava o bloco e recalcula topo (`pecas_perdidas` concatenado, `perda_pecas` somado). Sem `blocos`, edição atual. Bloqueio por reclassificação continua por episódio.

## 10. `src/lib/mcp/tools/pedido-detalhe.ts`
- Só o texto de `observacao_refacoes` explicando `blocos` e o significado do topo.

## Verificação
- Typecheck ao final e diff completo em `/mnt/documents/diff-refacao-varios-motivos.diff`.
- Sem gravar dados: verificação visual só abrindo o diálogo e cancelando, se possível.

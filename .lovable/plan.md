# Divisão de Corte — correção do bug + reparo em lote

## Parte A — corrigir a duplicação

Em `src/components/cop/CorteTab.tsx`:

1. A base da divisão passa a ser a grade que está na tela (`useMemo` com `desagrupar(grupos)`), e não `selected.pecas`. O diálogo de divisão recebe essa base, então quantidades editadas e não salvas aparecem corretamente.
2. Em `handleDivisao`, o restante é calculado sobre essa mesma base (`subtrairPecas(base, movidas)`).
3. Antes de criar o COP filho, o restante é validado com `validarPecasContraRecebidas`. Se ficar abaixo do já recebido: erro, nada é gravado, diálogo permanece aberto.
4. Depois de atualizar o pai com sucesso e antes do toast de sucesso, a grade é ressincronizada com `setGrupos(agrupar(restante))`. Assim "Salvar" ou "Voltar para o Romaneio" logo após a divisão não restaura as quantidades antigas.

Nenhum outro ponto do fluxo passa a chamar `setGrupos` (não sobrescreve digitação).

## Parte B — botão de reparo dos COPs já afetados

1. **Varredura** (`useMemo` sobre todos os COPs): entra na lista o pai com `corte_dividido = true`, com ao menos um filho, e cujas peças contêm integralmente a soma das peças dos filhos (cada linha modelo|cor|tamanho do filho existe no pai com qtd maior ou igual). Guarda pai, filhos, peças de hoje, peças dos filhos (`somarPecas`), resultado (`subtrairPecas`) e os totais.
2. **Botão** "Corrigir divisões duplicadas (N)" no topo da aba Corte, ao lado do refresh, ícone de alerta, contorno âmbar. Renderizado só para admin e só quando N > 0.
3. **Diálogo novo** `src/components/cop/CorrigirDivisoesDialog.tsx`, no padrão visual do diálogo de divisão: aviso explicativo, um bloco por COP pai com rótulos (ex.: `0081 → 0084`), totais Hoje / Nos filhos / Fica, e tabela Modelo | Cor | Tamanho | Hoje no COP | Está no(s) filho(s) | Fica (cor pintada como no diálogo de divisão). Rodapé com resumo geral. Botões Cancelar e Corrigir todos. Nada é gravado ao abrir.
4. **Aplicação em lote** ao confirmar: para cada pai, valida o resultado contra as `pecas_recebidas` daquele COP; se ficar abaixo do recebido, pula e acumula o motivo. `UPDATE` só na coluna `pecas`. Ao final: invalida a query de cops, ressincroniza a grade se o COP selecionado foi corrigido, toast de sucesso com COPs e peças, toast de erro listando os pulados, fecha o diálogo. Filhos nunca são alterados.

## Fora de escopo

Somente `CorteTab.tsx` é alterado e `CorrigirDivisoesDialog.tsx` é criado. Sem migração, sem SQL avulso, sem mudança de schema, RLS, status, datas, layout geral ou numeração.

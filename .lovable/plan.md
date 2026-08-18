# COP — Perdas por lançamento, com motivo próprio, correção e estorno

Sem migração, sem SQL. Tudo dentro dos JSONB `cops.perdas` (agregado, formato intacto) e `cops.historico_perdas` (append-only).

## 1. `src/lib/cop.ts`

- Ampliar `HistoricoPerda` com `tipo: "perda" | "correcao_perda" | "estorno_perda"` e campos opcionais `refere_em`, `item_idx`, `antes`, `depois`, `observacao`, `usuario_id`. Novo tipo `PerdaItemRef`. `CopPerdaLinha` não muda.
- Novo `lancamentosPerda(cop)`: percorre o histórico em ordem cronológica, gera um `LancamentoPerda` por item de evento `perda` (`em` + `item_idx`), aplica `correcao_perda` (a mais recente vence, `original` guarda o primeiro estado, alvo inexistente é ignorado) e marca `estornado` pelos eventos `estorno_perda`.
- Novo `motivosDaLinha(cop, modelo, cor, tamanho)`: motivos distintos vigentes, cronológicos, sem vazios, ignorando estornados.
- `getPerda`, `somarPerdas`, `subtrairPerdas`, `todasCompletas`, `refacoesDoCop`, `formatPerdasResumo`, `mesclarPerdasEmObservacoes` intactas.

## 2. `src/components/cop/RegistrarPerdaDialog.tsx`

Deixa de editar o total e passa a lançar perda nova.

- Props novas `historico` e `canManage`; `perdas` continua sendo o agregado.
- Colunas: Modelo · Cor · Tam. · Qtd · Já perdidas · Motivos já lançados · Perda agora · Motivo deste lançamento.
- "Perda agora" e o motivo começam vazios a cada abertura; motivo habilitado só com qtd > 0.
- Input de texto com filtro de inteiros (sem `type="number"`); teto por linha `já perdidas + perda agora ≤ qtd`, travando no máximo com célula vermelha e `máx N`.
- Rodapé: **Total deste lançamento** + linha menor com perdas acumuladas. Botão **Lançar perdas** desabilitado no zero.
- `onConfirm(lancamentos: CopPerdaLinha[])` — só os lançamentos novos, com motivo por item.
- Bloco recolhível **Lançamentos anteriores** (mais recente primeiro) com data/hora, qtd, modelo, chip de cor, tamanho e motivo; etiquetas `corrigido` (com original em tooltip) e `estornado` (riscado). Com `canManage`: botões **Corrigir** e **Estornar** (AlertDialog com o texto especificado e aviso de N itens).

## 3. `src/components/cop/CorrigirLancamentoPerdaDialog.tsx` (novo)

- Bloco "Como está hoje" somente leitura; bloco "Como deve ficar" com combobox de linha de destino restrito a `cop.pecas`, quantidade inteira (mín. 1, com a dica de usar Estornar para zerar), motivo e observação obrigatória.
- Validação de teto no destino calculada por delta, com erro em bloco vermelho dentro do diálogo.
- Modo somente leitura quando o COP está pago ou finalizado; aviso amarelo de impacto no saldo e no pagamento.

## 4. `src/components/cop/RomaneioTab.tsx`

- `salvarPerdas` passa a receber `{ cop, lancamentos }`: filtra qtd > 0, agrega com `somarPerdas`, valida teto contra `cop.pecas`, empilha evento `perda` **com motivo em cada item**, faz o backfill pontual de motivo vazio (só neste COP, só quando há exatamente uma linha correspondente no agregado com motivo), recalcula o campo `motivo` do agregado como o primeiro motivo cronológico, mantém `mesclarPerdasEmObservacoes` / `todasCompletas` / `refacoesDoCop` e atualiza apenas `perdas`, `observacoes_romaneio`, `historico_perdas` e `status`.
- Nova `corrigirLancamentoPerda`: bloqueia pago/finalizado, ajusta o agregado por `subtrairPerdas(antes)` + `somarPerdas(depois)`, valida teto, empilha `correcao_perda` sem tocar no evento original, recalcula status/observações, invalida `["cops"]` e `["perdas-cons-cops"]`.
- Nova `estornarLancamentoPerda`: subtrai os itens **vigentes** (derivados de `lancamentosPerda`), empilha `estorno_perda`, recalcula status (volta a Romaneio Parcial ou a Na Oficina quando nada resta).
- Linha do tempo: `perda` com `−` roxo, `correcao_perda` azul com antes/depois/observação no detalhe, `estorno_perda` com `+` verde. Fallback sintético preservado.
- Passar `historico`, `canManage`, `onCorrigir`, `onEstornar` ao `RegistrarPerdaDialog` e renderizar o novo diálogo.

## 5. `src/components/cop/PerdasTab.tsx`

Coluna Motivo (tabela por COP e bloco inferior) passa a listar todos os motivos vigentes via `motivosDaLinha`, separados por vírgula; traço quando vazio.

## 6. `src/lib/perdas-consolidado.ts`

Fonte A passa a gerar linhas de `lancamentosPerda(c)` filtrando `!estornado`, com valores corrigidos e `id` estável (`evento.em` + `item_idx`). Fallback, Fonte B, perdas manuais, reclassificações e `consumirRefeita` intactos.

## Fora de escopo

`src/lib/cop-saldos.ts` e todos os arquivos da lista protegida. Nenhuma migração, nenhum SQL, nenhum `type="number"` novo. Ao final, typecheck.

## Mudanças COP — Pagamento, Motivo de Perda e Navegação

### 1. Pagamento: admin-only + botão "Editar"
Em `src/components/cop/PagamentoOficinasTab.tsx`:
- **"Marcar como Pago"** passa a aparecer só para **admin** (hoje aparece para qualquer gestor COP).
- Enquanto o COP estiver em `pagamento_status = "liberado"`, exibir novo botão laranja **"Editar (voltar para Romaneio Completo)"** disponível para gestor COP ou admin. Ao clicar:
  - Zera `pagamento_status → "nao_pago"`, `pagamento_liberado_em → null`, `pagamento_liberado_por → null`, `observacoes_pagamento → null`.
  - Não muda o status do COP (continua "Aguardando Pagamento"/"Romaneio Completo" conforme o fluxo atual do romaneio).
- Novo botão **"← Voltar ao Romaneio"** que troca de aba mantendo o mesmo COP selecionado (via prop `onChangeTab` já usada em outras abas).
- Importar `Undo2` e `ArrowLeft` de `lucide-react`.

Nota: mantemos os três status atuais (`nao_pago`, `liberado`, `pago`). O documento cita "aguardando_pagamento" mas a própria nota final confirma que se mantém `liberado`.

### 2. Motivo da perda
- Expandir tipo `CopPerdaLinha` em `src/lib/cop.ts` com `motivo?: string | null`.
- Em `src/components/cop/RegistrarPerdaDialog.tsx`:
  - Estado `vals` passa a guardar `{ qtd, motivo }` por linha.
  - Nova coluna **Motivo** na tabela com `Select` mostrando os motivos configurados (fallback: "Defeito do tecido", "Tecido desfiado", "Erro de costura").
  - `confirmar()` inclui `motivo` no payload.
- `formatPerdasResumo` e histórico continuam funcionando (motivo é opcional).
- Em `src/components/cop/PerdasTab.tsx`, adicionar coluna Motivo na listagem de perdas do romaneio.

### 3. Configurações COP — lista de Motivos de Perda
- Migration: expandir `CHECK` de `app_lists.kind` para incluir `'motivo_perda'` e semear os 3 motivos padrão.
- `src/lib/cop.ts`: helpers `MOTIVOS_PERDA_PADRAO()` e `getMotivosPerdaFromList()`.
- Em `src/components/cop/CopConfigPanel.tsx` (já existe, hoje cuida de oficinas): adicionar seção **"Motivos de Perda"** com input + botão adicionar e lista com remover. Gestor COP e admin podem editar (mesmo perfil que já edita oficinas).
- `RegistrarPerdaDialog` carrega os motivos via `useAppList("motivo_perda")`.

### 4. Voltar ao Romaneio
Já coberto no item 1 (botão + prop `onChangeTab`). O container `/cop` já propaga `selectedId` entre abas via search params, então basta trocar `tab` mantendo o `copId`.

### Detalhes técnicos
- Nenhuma alteração em `src/lib/cop-saldos.ts`.
- Nenhuma alteração de RLS além do CHECK constraint de `app_lists`.
- Realtime já está ativo em `app_lists` no CopConfigPanel existente; reaproveitar.

### Arquivos alterados
- `src/lib/cop.ts` (tipo + helpers)
- `src/components/cop/RegistrarPerdaDialog.tsx`
- `src/components/cop/PagamentoOficinasTab.tsx`
- `src/components/cop/PerdasTab.tsx` (coluna motivo)
- `src/components/cop/CopConfigPanel.tsx` (seção motivos)
- Migration SQL: constraint + seed em `app_lists`

Confirma para eu implementar?

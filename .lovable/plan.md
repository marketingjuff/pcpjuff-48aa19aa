# Plano — PCP Juff v2 (4 blocos sequenciais)

Decisões aprovadas:

- **Status de Peças substitui completamente** o badge atual (aberto/completo/reaberto). O status "reaberto" vira o **asterisco** do 2A.
- **Pedido em Expedição permanece visível no Dashboard** — só some das abas quando a expedição finalizar o pedido via botão finalizar pedido.
- **Alerta de mudança de data** aparece apenas na aba **Dados In**.
- **Nota Fiscal** vira dropdown com opções iniciais: Sim / Não / Não se aplica. e pode ser editavel via painel de configuracoes.

---

## Bloco 1 — Renomeações e Campos Globais

### 1A. Status de Peças (substitui Status do Pedido)

- Migração DB: renomear coluna `status_geral` → `status_pecas` em `pedidos`. Valores aceitos: `"completo"` | `"incompleto"`. Migrar dados: `aberto`/`reaberto` → `incompleto`; `completo` → `completo`.
- Adicionar coluna `reaberto` boolean default false — preserva o sinal de "reabertura" para o asterisco do Bloco 2A (independente do Status de Peças).
- `src/lib/pedidos.ts`: trocar `STATUS_GERAL_OPCOES` por `STATUS_PECAS_OPCOES = ["completo","incompleto"]`. Atualizar tipo `Pedido` (campos `status_pecas`, `reaberto`). Atualizar `pedidoAtivoNasAreas` para usar `reaberto` no lugar de `status_geral === "reaberto"`.
- `src/components/pcp/shared.tsx`: substituir `StatusPedidoBadge`/`StatusPedidoChip` por `StatusPecasBadge`/`StatusPecasChip` (Completo = verde, Incompleto = cinza). Remover `statusGeralColorClass`.
- Substituir todos os labels "Status do Pedido" → "Status de Peças" em: DadosInTab, ArteTab, DTFTab, SilkTab, AcabamentoTab, ExpedicaoTab, FinalizadosTab, DashboardTab.
- Filtros: trocar select de status nos dashboards/abas para Completo/Incompleto.

### 1B. Ordenação default por data de saída

- Em todos os dashboards/listas (DashboardTab, DadosInTab, ArteTab, DTFTab, SilkTab, AcabamentoTab, ExpedicaoTab, FinalizadosTab e Dashboard do `_authenticated/index.tsx`): sort default ascendente por `data_saida_juff` (mais próxima primeiro; nulos por último). Filtros/busca não afetam o sort — apenas a ordem inicial.
- Ordem das colunas nas tabelas: garantir Etapa → Pedido → Orçamento → … idêntica em todas as abas (auditar e alinhar).

---

## Bloco 2 — Marcadores e Configurações

### 2A. Asterisco em pedidos reabertos

- `FinalizadosTab.tsx` — handler "Reabrir": setar `reaberto = true` e `finalizado_em = null` (não mexer mais em `status_geral`).
- `calcularEtapaAtual`: se `p.reaberto`, sufixar a string `etapa` com `"*"` (ex.: `"Aguardando DTF*"`).
- Aparece automaticamente no `EtapaBadgeFromPedido` (dashboards) e no `EtapaTopoBanner` (dentro do pedido).
- Ao finalizar pela Expedição (Bloco 3B): zerar `reaberto = false` junto com `finalizado_em`.

### 2B. Ícone "olho" no campo de senha

- `src/routes/auth.tsx`: adicionar botão toggle (lucide `Eye`/`EyeOff`) dentro do input de senha; alterna `type="password"`/`text"`. Default oculto.

### 2C. Dropdowns configuráveis: Tipo de Pagamento e Nota Fiscal

- Migração DB:
  - Adicionar valores `"pagamento"` e `"nf"` ao enum/uso de `app_lists.kind` (atualizar tipo TS `AppListKind`).
  - Alterar `pedidos.nf_emitida` de `boolean` para `text` (migrar `true`→`"Sim"`, `false`→`"Não"`, `null`→null). Renomear para `nf_status` para clareza (opcional, podemos manter o nome).
  - Seed inicial em `app_lists`: Tipo de Pagamento (Cartão de crédito, 50%/50%, Boleto, À vista) e NF (Sim, Não, Não se aplica).
- `app-lists.ts`: estender `AppListKind`.
- `configuracoes.tsx`: adicionar 2 painéis de gestão (CRUD) iguais aos existentes para `pagamento` e `nf`.
- Substituir os `<Select>` hard-coded de `forma_pagamento` e `nf_emitida` (em DadosInTab e ExpedicaoTab) pelos valores dinâmicos via `useAppList`.
- Remover constante `FORMAS_PAGAMENTO` de `pedidos.ts`.

---

## Bloco 3 — Fluxo Acabamento → Expedição

### 3A. Acabamento envia automaticamente para Expedição

- `AcabamentoTab.tsx`: remover botão "Mandar pra Expedição". No handler "Atualizar/Salvar", se `embalado === "Sim"` e `expedicao_entrou_em` for null, setar `expedicao_entrou_em = now()` no mesmo update.
- Confirmar que `calcularEtapaAtual` retorna `"Aguardando Expedição"` quando acabamento completo e ainda não finalizado — ajustar a lógica (hoje retorna "Finalizado" quando `acabamentoOk`). Nova regra: `acabamentoOk && !finalizado_em` → `"Aguardando Expedição"`; `finalizado_em` → `"Finalizado"`.

### 3B. Expedição finaliza

- `ExpedicaoTab.tsx`: adicionar botão verde **"Finalizar Pedido"** que seta `finalizado_em = now()` e `reaberto = false`. O botão "Atualizar Expedição" permanece, mas sem efeito de finalização.
- Pedido permanece visível no Dashboard enquanto em Expedição (já é o caso após a mudança em `calcularEtapaAtual`).

---

## Bloco 4 — Solicitação de Alteração de Data de Entrega

### 4A/4B/4C. Solicitação + Aprovação

- Migração DB: adicionar em `pedidos`:
  - `data_entrega_proposta date`
  - `data_entrega_proposta_em timestamptz`
  - `data_entrega_proposta_por uuid` (FK auth.users)
- Componente "Solicitar Alteração de Data de Entrega" no input do vendedor (Dados In ou onde estiver `data_entrega` editável):
  - Botão aparece apenas se `data_entrega != null` E `arte_data != null` (input de produção preenchido).
  - Caso contrário, vendedor edita `data_entrega` livremente.
  - Ao clicar: revela date input + Salvar/Cancelar. Salvar grava os 3 campos `data_entrega_proposta*`. Cancelar reseta o UI.
- Aviso na **DadosInTab** (input de produção), abaixo do botão Salvar/Atualizar:
  - Texto: `Solicitação de alteração de data de entrega para a data DD/MM/AA`
  - Botão **Aprovar**: copia `data_entrega_proposta` → `data_entrega` e limpa os 3 campos de proposta.
  - Não há "rejeitar" explícito — ignorar mantém a data original.

---

## Resumo de ordem e dependências


| Bloco | Entregar antes de | Migrações DB                                          |
| ----- | ----------------- | ----------------------------------------------------- |
| 1     | tudo              | rename status_geral→status_pecas; add `reaberto bool` |
| 2     | 3, 4              | extend app_lists.kind; nf_emitida bool→text; seed     |
| 3     | 4                 | —                                                     |
| 4     | —                 | add `data_entrega_proposta*` (3 colunas)              |


Cada bloco será entregue, validado pelo usuário e só então o próximo será iniciado.
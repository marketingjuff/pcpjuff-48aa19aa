
# Deixar todos os históricos legíveis para leigos

Hoje o histórico mostra o nome cru do campo (ex.: `arte_warning: sim → não`), o que é técnico. Vou trocar por rótulos e valores em português claro, aplicando o mesmo tratamento em **todos** os históricos do sistema (Histórico do Pedido, aba Histórico PCP, aba Histórico MAP, aba Histórico COP).

## O que muda visualmente

Exemplo do print:
- **Antes:** `arte_warning: sim → não`
- **Depois:** `Alerta de atenção na arte: Ativo → Removido`

Outros exemplos:
- `dtf_estampado: null → Sim` → **DTF estampado: Pendente → Concluído**
- `embalado: Não → Sim` → **Embalado: Pendente → Concluído**
- `tipo_estampa: DTF → DTF + Silk` → **Tipo de estampa: DTF → DTF + Silk** (já legível, mantém)
- `refacoes: […]` → **Refações: (lista atualizada)** (evita despejar JSON)
- `pecas_completadas_log: […]` → **Log de peças concluídas: (atualizado)**
- `historico_recebimentos: […]` → **Recebimentos: (atualizado)**
- `cortes: […]` → **Cortes: (atualizado)**
- `layout_url: "https://…"` → **Layout: (link atualizado)**
- `finalizado_em: null → 2026-07-13T…` → **Finalizado em: — → 13/07/2026 17:24**

## Como faço

1. **Criar `src/lib/audit-labels.ts`** — módulo único com:
   - `labelCampo(campo)` — dicionário PT-BR unificado cobrindo todos os campos de `pedidos`, `cops`, `cop_perdas`, `map_*`, `oficinas`, `pagamentos_consolidados`. Inclui os já existentes + humanização dos técnicos:
     - `arte_warning` → "Alerta de atenção na arte"
     - `necessita_vetorizacao` → "Precisa vetorizar"
     - `exp_cobranca_pagamento` → "Cobrança do pagamento (Expedição)"
     - `exp_pagamento`, `exp_etiqueta`, `exp_frete_solicitado`, `exp_despachado` → "Pagamento confirmado", "Etiqueta emitida", "Frete solicitado", "Pedido despachado"
     - `quem_bateu_dtf`/`silk` → "Quem estampou DTF/Silk"
     - `quem_cortou_dtf` → "Quem cortou o DTF"
     - `quem_revelou_tela` → "Quem revelou a tela"
     - `n_batidas_dtf/silk` → "Nº de batidas de DTF/Silk"
     - `dtf_pessoas_qtd` → "Nº de pessoas no DTF"
     - `pecas_completadas_log` → "Registro de peças concluídas"
     - `historico_data_entrega` → "Alterações na data de entrega"
     - `corte_em_correcao` → "Corte em correção"
     - `pagamento_consolidado_id` → "Pagamento consolidado (vínculo)"
     - `refacao_perda_origem_id` → "Refação de perda (origem)"
     - `refacao_perda_itens` → "Peças refeitas"
     - `alt_inicial` → "Altura inicial (m)"
     - `kg_solicitados/enviados/recebidos` → "Kg solicitados / enviados / recebidos"
     - etc.
   - `formatValor(campo, valor)` — formatador contextual:
     - **Booleanos genéricos** (`sim/true` / `não/false`) → "Sim" / "Não".
     - **Campos "alerta/warning"** (`arte_warning`) → "Ativo" / "Removido".
     - **Campos de execução binária** (`embalado`, `dtf_estampado`, `dtf_impresso`, `dtf_cortado`, `silk_feito`, `fotolito_impresso`, `fotolito_executado`, `tela_gravada`, `vetorizacao_executada`, `vetorizacao_dtf`, `vetorizacao_silk`, `dtf_executado`) → `Sim` vira "Concluído", `Não/null` viram "Pendente".
     - **`corte_em_correcao`, `corte_dividido`, `reaberto`, `finalizado`, `quebra_conciliada`** → "Sim" / "Não" (já legível, mas via mapa).
     - **`pagamento_status`** → dicionário: `aguardando` → "Aguardando", `liberado` → "Liberado para pagamento", `pago` → "Pago".
     - **`status_pecas`, `status_arte`, `status`, `status_malharia`, `tipo_estampa`** → passa direto (já são enums legíveis em PT-BR).
     - **`motivo`** (cop_perdas) → passa direto.
     - **Datas ISO `yyyy-mm-dd`** → `dd/mm/yyyy`.
     - **Timestamps ISO** (contêm `T`) → `dd/mm/yyyy hh:mm`.
     - **UUIDs de campos `*_id`, `feito_por`, `oficina_id`, etc.** → "referência atualizada" (não faz sentido mostrar UUID para leigo). Manter apenas quando já resolvido (nome).
     - **Arrays / objetos** (jsonb: `cortes`, `refacoes`, `pecas_completadas_log`, `historico_recebimentos`, `perdas`, `pecas_solicitadas`, `pecas_lisas`, `detalhes`, `valores_por_modelo`, `historico_data_entrega`, `correcoes_etapa`) → substitui o JSON cru por `"(lista atualizada)"` ou `"(N itens)"`.
     - **Strings longas** (>60 chars, ex.: `layout_url`, `observacoes`, `obs`, `arte_observacao`, `dtf_observacao`, `silk_observacao`, `acabamento_observacao`, `exp_observacoes`) → mostrar `"(texto atualizado)"` em vez de trecho truncado, com hover/title contendo o texto completo (via `title` HTML).
     - **Números** → mantém, com sufixo quando aplicável (`kg_*` → "12 kg", `alt_inicial` → "3,50 m", `valor_frete`/`valor_total` → "R$ 12,50").
     - **`null` / vazio** → "—".

2. **Refatorar `src/components/shared/AuditLogView.tsx`** — remover o `LABELS` e `fmtVal` locais e usar `labelCampo` + `formatValor` do novo módulo. Passar `campo` para o formatador de cada mudança. Renderizar strings longas com `title` para tooltip.

3. **Refatorar `src/components/pcp/HistoricoPedidoDialog.tsx`** — mesma coisa: remover `LABELS`/`fmtVal` locais e usar o módulo compartilhado.

4. **Nada mais muda** — banco, RLS, server functions, gravação de auditoria, filtros: tudo permanece igual. Só a camada de apresentação.

## Onde aparece

- Aba **Histórico** dentro de PCP, MAP e COP (usam `AuditLogView`).
- Botão **Histórico** no dialog do pedido em PCP (`HistoricoPedidoDialog`).

Ambos passam a puxar rótulos e valores do mesmo módulo, então a padronização vale para todos os históricos do sistema de uma vez.

## Fora do escopo

- Não altero o que é gravado no `audit_log` (schema/gatilhos).
- Não escondo campos técnicos; se algum campo ainda ficar cru é adicionar rótulo depois — o fallback continua sendo o nome do campo, para não perder informação.

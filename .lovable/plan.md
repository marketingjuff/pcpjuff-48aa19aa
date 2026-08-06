# Captação de Vídeo + Monitor PCP

Somente os arquivos autorizados no prompt são tocados. Nada de COP, MAP, SUP, KPI; `src/lib/cop-saldos.ts` intacto. Migração 100% aditiva.

## 1. Migração (aditiva)

`supabase/migrations/<ts>_monitor_pcp_e_captacao_video.sql`, exatamente o SQL do prompt:

- `pedidos`: `ADD COLUMN IF NOT EXISTS necessita_captacao_video`, `video_captado_silk`, `video_captado_dtf` (boolean).
- `CREATE TABLE IF NOT EXISTS pcp_capacidade_etapa (etapa PK, teto_dia, atualizado_em, atualizado_por)`, RLS ligada, SELECT para `authenticated`, INSERT/UPDATE só admin via `has_role`, mais os `GRANT SELECT/INSERT/UPDATE` para `authenticated` e `GRANT ALL` para `service_role` (sem grant a Data API a tabela fica inacessível).
- `INSERT ... ON CONFLICT DO NOTHING` com arte 900, dtf 700, silk 900, acabamento 900.

Nenhum `DROP`, `TRUNCATE`, `DELETE`, rename ou mudança de tipo. Tipos regenerados depois.

## 2. Bloco A — Captação de vídeo

**`DadosInTab.tsx`**
- Checkbox "Captação de vídeo da produção — (cliente pediu vídeo da estamparia sendo feita)" no card Input do Vendedor, não obrigatório, desabilitado em `soLeituraVendedor`.
- `AlertDialog` de confirmação ao marcar e outro ao desmarcar, com os textos do prompt. Cancelar reverte; nada é gravado no dialog, só no "Salvar Input do Vendedor".
- No salvamento do Input de Produção: se `necessita_captacao_video` e o tipo inclui Silk e/ou DTF, checa se o intervalo `inicio_estamparia`→`termino_estamparia` (extremos inclusive) contém alguma segunda ou quinta. Se não, `toast.warning` amarelo com o texto do prompt e **salva mesmo assim**. Nenhuma validação existente é alterada.

**`SilkTab.tsx` / `DTFTab.tsx`**
- Moldura vermelha grande no topo (borda grossa, fundo vermelho claro, ícone de alerta): "CHAMAR O MARKETING PARA FAZER O VÍDEO DESTA PRODUÇÃO", com botão "Vídeo captado".
- Silk usa `video_captado_silk` + tipo inclui Silk; DTF usa `video_captado_dtf` + tipo inclui DTF. Independentes. Botão grava via o `onSave` já existente e a moldura desaparece. Sem histórico/autor.

## 3. Bloco B — Monitor PCP

**`src/lib/pcp-monitor.ts`** (puro, sem React)
- Cargas: arte = `n_batidas_dtf` no dia `arte_data` (0 se só Silk/Lisa); dtf/silk = `qtd` no intervalo de estamparia conforme o tipo; acabamento = `qtd` no intervalo de acabamento. Nulos → 1 / 0, nunca `NaN`.
- `tetoEfetivo = floor(teto × (1 − 0,01 × (nPedidosNoDia − 1)))`, com `nPedidosNoDia` contado sobre as datas gravadas, antes da simulação.
- Simulação por faixa: pedidos ordenados por `saida_juff` crescente, carga distribuída pelos dias úteis (`dias-uteis.ts` + feriados), escorregando para o próximo dia útil inclusive além do término. Marca estouro por dia e por pedido vazado. Cores: ≤80% verde, ≤100% amarelo, >100% ou dia com vazamento vermelho.
- Tudo em memória. Nenhuma escrita no banco.

**`src/hooks/use-capacidade.ts`** — leitura/gravação de `pcp_capacidade_etapa` com TanStack Query e invalidação.

**`MonitorPcpTab.tsx`**
- Janela de 1 mês antes a 4 meses depois de hoje. Entram pedidos não finalizados com ao menos uma de `arte_data`, `inicio_estamparia`, `inicio_acabamento`. Linhas ordenadas por `saida_juff` crescente, nulos por último.
- Faixa de calor fixa no topo (`FaixaCalor.tsx`) com Arte/DTF/Silk/Acabamento e botão de recolher para linha única — estado em `localStorage`.
- Zoom Semana (padrão) / Dia, persistido em `localStorage`. Semana: coluna seg–sex, cor do pior dia, rodapé "3/5 dias no limite". Dia: colunas estreitas, ~4 semanas, linha vermelha de hoje e botão "Hoje".
- Filtros: busca por nº de pedido/cliente, filtro por `tipo_estampa`, toggle "só atrasados".
- Engrenagem de capacidade só para admin (`useIsAdmin`).

**`GanttPedidos.tsx`**
- Losango na arte, barra de estamparia (bicolor quando DTF+Silk), barra de acabamento, bandeira na Saída Juff. Etiqueta `#pedido · cliente · qtd pçs · tipo_estampa`. Ícone 📷 com captação de vídeo e ⚠ em etapa vencida usando a lógica de pendência já existente em `src/lib/pedidos.ts`, sem alterá-la.
- Clique na linha abre painel lateral com resumo, "Editar datas" e atalho para a aba da etapa.

**Arrasto**
- Só com `pcp.monitor` em nível edição. Move a linha inteira em dias úteis; blocos de 5 dias úteis no zoom Semana, dia a dia no zoom Dia.
- Move apenas `arte_data`, `inicio_estamparia`, `termino_estamparia`, `termino_acabamento`. `inicio_acabamento` é recalculado reaproveitando a fórmula do `DadosInTab.tsx` (extraída para `pcp-monitor.ts` e reimportada lá, sem duplicar regra). `saida_juff` nunca se move.
- Etapa já executada não se move: arte finalizada, `dtf_estampado`/`silk_feito` = "Sim", acabamento já embalado.

**`EditarDatasDialog.tsx`**
- Abre antes de qualquer gravação quando o `termino_acabamento` passa da `saida_juff` ou quando há captação de vídeo e o novo intervalo de estamparia não pega segunda nem quinta. Mensagem no topo diz qual conflito disparou.
- Editáveis com `DateInputBR`: Dias de Secagem, Arte, Início/Término Estamparia, Término Acabamento. Início de Acabamento e Saída Juff em cinza, somente leitura, com a explicação "calculada — só muda pela data de entrega, no Input do Vendedor".
- Mesmas validações de ordem do `DadosInTab.tsx`. Botão "Encaixar na próxima segunda/quinta (dd/mm)" no caso da regra de vídeo. Salvar usa o mesmo upsert; cancelar devolve o pedido à posição original.

**`CapacidadeDialog.tsx`** — quatro campos numéricos (Arte, DTF, Silk, Acabamento) gravando em `pcp_capacidade_etapa`, só admin.

## 4. Registro

- `src/lib/permissoes.ts`: acrescenta `{ key: "pcp.monitor", modulo: "pcp", tabValue: "monitor", label: "Monitor PCP", nivelConfiguravel: true }` logo após `pcp.dashboard`. Nada removido ou renomeado.
- `src/routes/_authenticated/index.tsx`: aba `monitor` depois de "Dashboard", no mesmo padrão `TabsTrigger` + `TabsContent forceMount hidden`, respeitando `abasPcp`, `pode()` e `soLeitura()`.

## Notas técnicas

Grid do Gantt em CSS grid com colunas por dia/semana; arrasto por pointer events com offset em dias úteis, sem biblioteca nova. Recharts não é usado. Colunas novas em `pedidos` são opcionais, então nenhum formulário existente passa a exigir campo novo.

## Resumo do que mudará

Tudo abaixo é **apenas na aba Arte, no Dashboard da aba Arte e em Configurações**. Nada será alterado em DTF, Silk, Acabamento, Expedição ou Finalizados. Tipo "Lisa" não é tocado.

---

### 0. Resposta direta ao item 5.5

**Hoje a plataforma NÃO avança os lados DTF e Silk de forma independente.** O avanço usa `status_arte === "Arte Finalizada"` como gatilho único:

- `calcularEtapaAtual` (`src/lib/pedidos.ts`) só sai de "Aguardando Arte" depois que `arteOk` (Arte Finalizada) é verdadeiro — só então passa a calcular "Aguardando DTF" / "Aguardando Silk".
- `PendenciasBanner` e os filtros de Etapa do Dashboard usam a mesma chave.
- As abas DTF e Silk em si **não bloqueiam** por status da arte (só filtram por `tipo_estampa`), então a tela já existe; o que precisa mudar é a **regra de etapa** para considerar cada lado pronto independentemente.

Impacto: é um ajuste **médio**, concentrado em `calcularEtapaAtual` + helpers `arteCompleta`. Pedidos em andamento continuam funcionando — quem já está "Arte Finalizada" continua avançando; quem ainda não está passa a avançar lado a lado conforme a nova regra. Recomendo manter "Arte Finalizada" como opção default no Status da Arte para retrocompatibilidade visual, mas ela vira **informativa** (não trava nada).

---

### 1. Banco de dados (migração)

Adicionar colunas em `pedidos`:
- `dtf_cortado text` (Sim/Não)
- `dtf_cortado_data date` (data manual quando Sim)
- `vetorizacao_dtf text` (Sim/Não/Não se aplica)
- `vetorizacao_silk text` (Sim/Não/Não se aplica)

Manter `vetorizacao_executada` por enquanto (não remover na mesma migração) e fazer **backfill**: para pedidos com `necessita_vetorizacao = true`, copiar `vetorizacao_executada` → `vetorizacao_silk` quando o tipo for Silk, → `vetorizacao_dtf` quando for DTF, e para DTF+Silk copiar para o lado Silk (compatibilidade — usuário decide depois).

Renomear conceitualmente "DTF Impresso Executado" → continua usando a coluna existente `dtf_executado` como "data do DTF Impresso" (sem mudança de schema; só rótulo na UI).

Em `app_lists`: permitir nova `kind = 'status_arte'` (atualizar CHECK constraint se existir) e fazer seed inicial com "Imprimindo", "Aprovar Amostra", "Arte Finalizada" para não quebrar telas atuais. `AppListKind` em `src/lib/app-lists.ts` ganha `"status_arte"`.

GRANTs e RLS seguem o padrão das colunas existentes (sem novas policies — herda da tabela).

---

### 2. `src/lib/pedidos.ts` (regras)

- Helpers novos:
  - `dtfFinalizadoArte(p)` = `dtf_impresso === "Sim" && dtf_cortado === "Sim" && dtf_executado && dtf_cortado_data`
  - `fotolitoFinalizadoArte(p)` = `fotolito_impresso === "Sim" && fotolito_executado === "Sim" && fotolito_executado` (data já existe)
  - `vetorizacaoDtfResolvida(p)` = vendedor marcou Não OU `vetorizacao_dtf` ∈ {Sim, Não, Não se aplica}
  - `vetorizacaoSilkResolvida(p)` = idem para Silk
  - `ladoDtfPronto(p)` e `ladoSilkPronto(p)` combinando os dois acima
- `arteCompleta(p)`: passa a exigir lados prontos conforme o tipo (DTF, Silk, DTF+Silk), **sem depender** de `status_arte`.
- `calcularEtapaAtual`: substitui `arteOk` por verificação por lado. Se o lado DTF está pronto, ele já conta como "fora de Aguardando Arte" para aquele lado; se o lado Silk não está, ainda aparece "Aguardando Silk (arte)". Texto final: mantém os mesmos rótulos atuais ("Aguardando DTF", "Aguardando Silk", "Aguardando DTF + Silk") — só a condição de entrada muda.
- `STATUS_ARTE_OPCOES`: deixa de ser fonte de verdade; vira fallback. UI lê de `useAppList("status_arte")`.
- Em `setImpresso`/save: quando `dtf_cortado` voltar para "Não", zerar `dtf_cortado_data`. Mesmo já existe para `dtf_executado`/`fotolito_executado` e se mantém.

---

### 3. `src/components/pcp/ArteTab.tsx`

**Parte de cima (somente leitura — duas linhas):**
- Linha 1: Pedido · Orçamento · Tipo de Estampa · Vetorização (vinda do Dados In)
- Linha 2: Data de Entrada · Data Limite da Arte · Saída Juff · Data de Entrega

Remover desta seção: UF, Layout, "Vetorização?" duplicada. O botão **Baixar layout** vira o gatilho que revela a parte de baixo (item 6.2 do brief: "aparece após baixar o layout").

**Parte de baixo (editável, condicional):**
- Estado local `layoutBaixado` (boolean, por pedido — pode ser memória da sessão; não precisa persistir). Enquanto `false`, mostrar só o botão "Baixar layout"; ao clicar, baixa o PDF e libera os campos.
- Campos de **vetorização** só aparecem se `selected.necessita_vetorizacao === true`, e cada um com 3 opções (Sim/Não/Não se aplica). Renderiza `vetorizacao_dtf` se tipo inclui DTF, `vetorizacao_silk` se inclui Silk.
- **Só DTF**: vetorização_dtf · DTF Impresso (+ data quando Sim) · DTF Cortado (+ data quando Sim) · Status da Arte
- **Só Silk**: vetorização_silk · Fotolito Impresso · Fotolito Executado · Status da Arte
- **DTF + Silk**: linha DTF, linha Silk, linha Status da Arte (Status da Arte ocupa linha própria).
- Status da Arte usa `useAppList("status_arte")` (livre; nenhuma opção obrigatória).
- Salvar inclui os novos campos: `dtf_cortado`, `dtf_cortado_data`, `vetorizacao_dtf`, `vetorizacao_silk`. `vetorizacao_executada` deixa de ser escrita pela Arte (mas continua no schema por enquanto).
- `arteAtrasada` deixa de usar `Arte Finalizada` como gate (regra antiga); usa `arteCompleta(p)`.

Dashboard da Arte (parte de baixo do `ArteTab.tsx`) **continua existindo** e é o mesmo Dashboard descrito no item 8 — abaixo.

---

### 4. Dashboard da Arte (item 8 — substitui o atual `Dashboard — Arte` dentro de `ArteTab.tsx`)

**Filtros (nessa ordem):** Etapa · Pedido/Orçamento · Tipo de Estampa · DTF Finalizado · Fotolito Finalizado · Status da Arte. Os 3 últimos filtram pelos valores calculados ("Aguardando impressão" / "Aguardando corte" / "Aguardando execução" / "Sim").

**Colunas (exatamente nessa ordem, 13 colunas):**
Etapa · Pedido · Orçamento · Vendedor · Qtd · Estampa · Status das Peças · DTF Finalizado · Fotolito Finalizado · Status da Arte · Data de Entrada · Data Limite · Saída Juff.

Cabeçalho `Tipo` → **Estampa**. Remover do Dashboard da Arte: FRETE, UF, STATUS ARTE atual (texto puro), ENTREGA (item 8.4: Data de Entrega não entra).

**Coluna calculada "DTF Finalizado"** (helper em `pedidos.ts`):
- `dtf_impresso !== "Sim"` → "Aguardando impressão"
- `dtf_impresso === "Sim" && dtf_cortado !== "Sim"` → "Aguardando corte"
- ambos Sim → "Sim"
- tipo não inclui DTF → "—"

**Coluna calculada "Fotolito Finalizado"**:
- `fotolito_impresso !== "Sim"` → "Aguardando impressão"
- `fotolito_impresso === "Sim" && fotolito_executado !== "Sim"` → "Aguardando execução"
- ambos Sim → "Sim"
- tipo não inclui Silk → "—"

Manter setas de ordenação, alerta amarelo/vermelho e estilo de cabeçalho conforme já implementado.

---

### 5. `src/components/pcp/DadosInTab.tsx`

**Mudança única:** rótulo "Tipo de Estampa" continua **inalterado** no Dados In (item 1.2 — só muda em Arte/Dashboard). Não tocar nessa aba **exceto** garantir que `vetorizacao` siga sendo só o Sim/Não do vendedor (sem "Não se aplica"). Nada a alterar.

---

### 6. `src/routes/_authenticated/configuracoes.tsx`

Adicionar nova seção de personalização "Status da Arte" usando `useAppList("status_arte")` e `useAppListMutations("status_arte")`, no mesmo padrão visual das outras listas. Permite criar/renomear/remover sem opções obrigatórias. Nada mais nessa rota é alterado.

---

### 7. Outros pontos

- `PendenciasBanner.tsx` (linha 14): a checagem `status_arte === "Arte Finalizada"` é substituída por `arteCompleta(p)` (pela nova definição). Esse é o único arquivo fora do escopo Arte/Dashboard/Configurações que precisa de ajuste — sem ele, o banner de pendências passaria a sinalizar "arte pendente" mesmo quando os lados estão prontos.
- Nenhuma alteração em `DTFTab.tsx`, `SilkTab.tsx`, `AcabamentoTab.tsx`, `ExpedicaoTab.tsx`, `FinalizadosTab.tsx`, `DashboardTab.tsx` (Master).
- Textos livres em todos os novos inputs (sem máscara/limite). Sem restrições por equipe/cliente.

---

### Arquivos que serão tocados

- `supabase/migrations/<novo>.sql` — colunas + extensão de `app_lists.kind` + seed Status da Arte
- `src/integrations/supabase/schema-extras.ts` — tipos das novas colunas
- `src/lib/pedidos.ts` — helpers, `arteCompleta`, `calcularEtapaAtual`, opcional `STATUS_ARTE_OPCOES`
- `src/lib/app-lists.ts` — `AppListKind` += `"status_arte"`
- `src/components/pcp/ArteTab.tsx` — formulário superior/inferior e Dashboard da Arte
- `src/components/pcp/PendenciasBanner.tsx` — usar `arteCompleta`
- `src/routes/_authenticated/configuracoes.tsx` — seção Status da Arte

Aguardando sua aprovação para implementar.
# Plano de Alterações — PCP JUFF

Vou implementar em **4 fases**. Cada fase termina em algo testável.

---

## Fase 1 — Infraestrutura (base para o resto)

**Banco / Schema**
- Tabela `feriados` (id, data, descricao) + GRANTs + RLS (todos autenticados leem/escrevem).
- Tabela `app_role` enum: `admin | gestor | arte | dtf | silk | acabamento`.
- Tabela `user_roles` (user_id, role, areas_extras text[]) + função `has_role()` security definer.
- Tabela `profiles` (id, email, nome) com trigger `on_auth_user_created` que:
  - cria o profile;
  - se o e-mail for `juliana@`, `flavio@` ou `marketing@juff.com.br`, atribui role `admin` automaticamente.
- Novos campos em `pedidos`: `data_entrega`, `saida_juff`, `tempo_producao`, `uf_entrega`, `necessita_vetorizacao` (bool), `obs_vendedor`, `layout_url`, `vetorizacao_executada` (bool), `quem_bateu_dtf`, `quem_bateu_silk`, `responsavel_acabamento`, `tela_gravada`, `embalado`, `finalizado_em` (timestamp).
- Renomear `modelo_estampa` → `tipo_estampa`, `status` → `status_geral`.
- Novos status de arte: `imprimindo | aprovar_amostra | arte_finalizada`.

**Storage**
- Bucket privado `layouts` para PDFs (até 30MB), com policies para autenticados.

**Permissões (RLS)**
- Política nas tabelas baseada em `has_role()`:
  - Admin: tudo.
  - Gestor: SELECT tudo, UPDATE somente colunas de Dados In + reabertura (`finalizado_em = null`); colunas extras liberadas via `areas_extras`.
  - Arte/DTF/Silk/Acabamento: SELECT tudo, UPDATE só das colunas da sua aba.
- Implementado via `has_column_access(area)` helper.

**Painel de Configurações (admin)**
- Nova rota `/_authenticated/configuracoes` com 2 abas: **Feriados** (CRUD) e **Usuários**.
- Aba Usuários: lista usuários, cria conta via **server function** `createUserAccount` que usa `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true })` e insere role + `areas_extras`. Admin define e-mail+senha inicial.
- Acesso à página bloqueado para não-admin.

---

## Fase 2 — Dados In + Arte

**Dados In**
- Layout dividido em 2 colunas: **Input do Vendedor** (verde claro) | **Input de Produção** (azul claro), nas ordens especificadas.
- Novos campos: Data de Entrega, UF, Vetorização?, Layout (upload PDF), Obs. do vendedor.
- Cálculos automáticos: **Saída Juff = Data de Entrega − tempo de frete** (dias úteis, considerando feriados); **Tempo de produção = dias úteis entre Entrada e Saída Juff**.
- Visual: Orçamento Comercial em destaque (só número, grande, read-only).
- Trocar posições Orçamento ↔ Pedido Olist. Remover coluna "Pedidos" e botão "Duplicar".
- **Dashboard Dados In** abaixo do form com colunas listadas (scroll horizontal).

**Arte**
- "Pedido OK" → **Status da Arte** (Imprimindo / Aprovar Amostra / Arte Finalizada).
- Remover "Qual estampa/descrição". Remover coluna "Pedidos" e adicionar **Dashboard da Arte** (com Frete, Tempo de Frete, UF).
- DTF Impresso e Fotolito Impresso: dropdown só Sim/Não.
- Visibilidade condicional dos pares conforme Tipo de Estampa (DTF / Silk / DTF+Silk / Lisa).
- Reset de data quando status volta para Não.
- Espelho de Vetorização (Sim/Não) do Dados In + flag "executado".
- Renomear data "DTF Impresso" → "DTF Impresso Executado".

**Helper compartilhado**
- `lib/dias-uteis.ts` usando feriados.
- `useUnsavedChanges` hook + diálogo global "Tem certeza que deseja sair?" (Salvar verde / Não Salvar vermelho), bloqueando troca de aba e navegação.
- `lib/format.ts`: `formatDateBR(date)` → `dd/mm/aa` aplicado em toda a plataforma.

---

## Fase 3 — DTF, Silk, Acabamento, Finalizados

**DTF**
- Campo "Quem bateu o DTF?" (Jefferson, Sarah, Rubens, Outros).
- Remover coluna "Pedidos" → **Dashboard do DTF** (filtros: Orçamento, Pedido, Status, DTF Impresso, DTF Estampado).
- Puxar status DTF Impresso da Arte; banner amarelo persistente "arte pendente" se Não.
- Reordenar: DTF Impresso antes do Início Estamparia.
- Reset data ao mudar "DTF Estampado?" para Não; renomear para **DTF Estampado Executado**.
- Mostrar só a data de término (sem cálculo de dias).
- Dependência Silk+DTF visível.

**Silk**
- Campo "Quem bateu o Silk?" (Gleisson, Marcelo, Outros).
- **Dashboard do Silk** (filtros: Orçamento, Pedido, Status, Tela Gravada, Silk Feito).
- Puxar status Fotolito Impresso da Arte; banner amarelo "arte pendente".
- Reordenar Fotolito Impresso antes do Início Estamparia.
- Reset data; renomear para **Data Executada de Silk**.

**Acabamento**
- Responsável: Vanessa, Patrícia, Juliana, Outros.
- Remover "DTF OK" e "Silk OK" (vêm automáticos). Renomear "Silk Feito" → **Silk Estampado?**.
- Reset: se Embalado? = Não/vazio → Data Saída Juff e Responsável ficam vazios.
- Mostrar Data de Entrega vinda do Dados In.
- **Dashboard do Acabamento** (filtros Orçamento, Pedido, DTF Estampado, Silk Estampado) com colunas Saída Juff e Data Entrega.
- Indicador: quando Embalado=Sim e demais campos completos → marca `finalizado_em = now()`.

**Finalizados (nova aba)**
- Lista pedidos onde `finalizado_em IS NOT NULL`.
- Saem dos dashboards das outras abas.
- Resumo com filtros + filtro de período (padrão TUDO).
- Botão "Reabrir" → seta `finalizado_em = null`, volta para Acabamento.

---

## Fase 4 — Dashboard Master + Avisos Globais

**Dashboard Master**
- Renomear "Dashboard" → **Dashboard Master**.
- Cards do topo: remover Abertos/Completos. Manter **Total** e **Atrasados**. Adicionar contagens por área (Arte, DTF, Silk, Acabamento). Silk+DTF conta nas duas. Finalizados não contam. Todos clicáveis aplicam filtro.
- Painel de **Pendências** no topo (Atrasados + Aguardando etapa anterior), clicável.
- Colunas: adicionar Data de Entrega e Frete.
- Ordenação: clique no cabeçalho "Dias" alterna asc/desc.
- Filtros: Vendedores, Status Geral, Tipo de Estampa (renomeado), **Todas as Etapas** (com opção "todas menos finalizados"), Data de Entrega, Frete.
- "Dias" = dias úteis até a entrega.

**Avisos persistentes (topo, globais)**
- Componente `<PendenciasBanner />` no layout `_authenticated`:
  - amarelo: aguardando etapa anterior;
  - vermelho: atrasado.
- Visível enquanto a pendência existir; some quando resolve. Vale para todas as abas.

**Observações renomeadas**
- "Observações da Arte / do DTF / do Silk / do Acabamento" conforme a aba.

---

## Detalhes técnicos

- **Edge functions Supabase NÃO** serão usadas. Toda lógica server-side vai em `createServerFn` do TanStack Start (admin de usuários, upload de PDF, cálculos sensíveis).
- `supabaseAdmin` só dentro do handler (`await import('@/integrations/supabase/client.server')`), após checar `has_role(userId, 'admin')`.
- Cálculo de dias úteis no cliente quando puramente de exibição; nas mutações que gravam `saida_juff`/`tempo_producao`, calcular antes de salvar.
- `Pedido` type será regenerado a partir do schema novo.
- Realtime continua via `postgres_changes` na tabela `pedidos`.

## Risco / pontos a confirmar depois

- Reset de campos no Acabamento quando `embalado` = Não: confirmamos que **não** deve apagar dados da Arte/DTF/Silk, apenas os do próprio Acabamento. (assumindo que sim)
- "Tempo de Frete" — assumindo coluna já existente em pedidos; se não existir, adicionar na Fase 1.
- Bucket `layouts` privado: PDFs servidos por URL assinada de curta duração (1h) gerada no cliente.

Posso começar pela Fase 1 quando você aprovar.

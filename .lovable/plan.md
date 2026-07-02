
# Plano — Refação: identificação de problemas + Retrabalho ampliado

Escopo estritamente PCP. Não toca `src/components/cop/*`, `src/lib/cop*.ts`, nem `DashboardTab.tsx`. Banco apenas aditivo (INSERT de seeds em `app_lists`).

## 1. Tipos e helpers (aditivos)

**`src/lib/pedidos.ts`** — em `RefacaoEpisodio`, adicionar campos opcionais:
- `area_identificou?: string`
- `erro_producao?: boolean`
- `area_erro?: string`
- `problema?: string`

**`src/lib/app-lists.ts`** — estender union `AppListKind` com:
`refacao_problema_arte | refacao_problema_dtf | refacao_problema_silk | refacao_problema_acabamento`.

**`src/components/pcp/refacao-helpers.ts`** — propagar os 4 novos campos do payload até o objeto salvo em `refacoes` (jsonb).

## 2. Dialog de refação

**`src/components/pcp/RefacaoDialog.tsx`** — no topo, antes dos campos atuais:

1. Select obrigatório "Qual área identificou o problema?" → `Defeito de fabricação | Arte | DTF | Silk | Acabamento`.
2. Radio obrigatório "Houve erro da produção?" → Sim/Não.
3. Se Sim: Select "Qual área errou?" (mesmas 5 opções) + Select "Qual foi o problema?" cuja lista depende da área:
   - `Defeito de fabricação` → `useAppList("motivo_perda")` (reuso, sem duplicar)
   - `Arte/DTF/Silk/Acabamento` → `useAppList("refacao_problema_<area>")`
4. Validação: bloquear submit se obrigatórios não preenchidos.
5. Renomear label "Motivo" → "Observações da refação" (campo interno permanece `motivo`).

## 3. Exibição dos novos campos

**`src/components/pcp/RetrabalhoTab.tsx`** (EpisodioCard) e **`RefacaoViewerButton.tsx`**:
- "Identificado por: {area_identificou ?? '—'}"
- "Erro da produção: Sim/Não" e, se Sim, "Área: {area_erro} — Problema: {problema}"
- Label "Motivo" → "Observações". Ausente → `—`.

## 4. Configurações → Listas em sub-abas

**`src/routes/_authenticated/configuracoes.tsx`** — dentro da aba "Listas", introduzir Tabs internas:
- **Dados In:** Vendedores, Frete, Tipo de Pagamento, Nota Fiscal
- **Arte:** Status da Arte
- **Produção:** Operadores DTF, Quem cortou DTF, Operadores Silk, Quem revelou tela, Responsáveis Acabamento
- **Refação:** 4 novas listas + nota fixa "Problemas de Defeito de fabricação são gerenciados nas configurações do COP (Perdas)."

Reusa `ListaCard`. Nenhuma remoção.

## 5. Cards da aba Retrabalho

**`src/components/pcp/RetrabalhoTab.tsx`** — StatCards:
- **Remover:** "Etapa que mais gera perda".
- **Manter:** Peças refeitas, Peças perdidas, Adesivos perdidos, % Retrabalho.
- **Adicionar 7 cards** (filtro de período já existente):
  1. Lista de Problemas (clicável → Dialog com ranking + BarChart horizontal `recharts` + tabela)
  2. Área que mais identifica (clicável → Dialog análogo)
  3. Refações abertas (`episodioAberto`)
  4. Reincidência (pedidos com ≥2 episódios)
  5. Tempo médio de resolução (dias entre abertura e fechamento; sem dado → `—`)
  6. Peças perdidas no mês (com delta vs mês anterior)
  7. Problema recorrente do mês (últimos 30 dias)

Episódios sem `problema`/`area_identificou` ignorados nos cards 1, 2 e 7.

## 6. Migração (SQL — apenas INSERT idempotente)

Um único `supabase--migration` inserindo os 4 kinds novos em `app_lists` com `WHERE NOT EXISTS` por (kind, value):

- `refacao_problema_arte`: Faltando algo na estampa; Cor da estampa; Falta de poliamida nos adesivos
- `refacao_problema_silk`: Posicionamento no Fotolito/Tela; Vestimenta da peça no berço; Troca de cores nas estampas; Troca de peças com orçamentos diferentes (complemento ou peças faltando)
- `refacao_problema_dtf`: Posicionamento; Troca de nomes no tamanho; Estampa torta; Adesivo sem poliamida; Troca de lado da estampa
- `refacao_problema_acabamento`: Cortar linha no arremate; Furar peça ao arrematar; Contagem errada; Peça com costura aberta; Peça faltando estampa

Sem DROP/DELETE/ALTER destrutivo. Sem alterar `refacoes` (já é jsonb).

## Arquivos alterados
- `src/lib/pedidos.ts` (tipos)
- `src/lib/app-lists.ts` (union)
- `src/components/pcp/refacao-helpers.ts` (propagação)
- `src/components/pcp/RefacaoDialog.tsx` (UI + validação)
- `src/components/pcp/RefacaoViewerButton.tsx` (exibição)
- `src/components/pcp/RetrabalhoTab.tsx` (exibição + cards + dialogs)
- `src/routes/_authenticated/configuracoes.tsx` (sub-abas em Listas)
- 1 migração INSERT-only

Aguardando aprovação para implementar.

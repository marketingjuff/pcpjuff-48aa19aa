# Perdas contam como "entregue" para fechar o Romaneio

Sem tocar em PCP, `cop-saldos.ts`, `cops.pecas` (corte) e sem alterar a lógica de pagamento.

## 1. Migração SQL (aditiva)

```sql
ALTER TABLE cops ADD COLUMN IF NOT EXISTS historico_perdas jsonb NOT NULL DEFAULT '[]'::jsonb;
```

## 2. `src/lib/cop.ts`

- Novo tipo `HistoricoPerda = { em, tipo: "perda", total, itens: CopPerdaLinha[] }`.
- Adicionar `historico_perdas: HistoricoPerda[]` no `type Cop`.
- Novo helper `getPerda(perdas, m, c, t)`.
- Estender `todasCompletas(pecas, rec, perdas = [])` — retrocompatível — considerando `recebido + perdido ≥ qtd` por linha.

## 3. `src/components/cop/RomaneioTab.tsx`

**a) `salvarPerdas`**
- Diff entre `perdas` novas e `cop.perdas` (só o que aumentou vira registro `HistoricoPerda`).
- Append em `historico_perdas`.
- Recalcular status com `todasCompletas(cop.pecas, cop.pecas_recebidas, perdasNovas)`:
  - Se completo E status ∈ {`Na Oficina (Costura)`, `Romaneio Parcial`} → `Romaneio Completo`.
  - Senão, se houver ao menos recebido/perda em alguma linha e status ∈ {`Na Oficina (Costura)`} → `Romaneio Parcial`.
  - Nunca regredir estágios pós-completo (`Romaneio Completo`, `Aguardando Pagamento`, `Finalizado`, etc.).
- Persistir `perdas`, `observacoes_romaneio`, `historico_perdas`, `status` num único update.

**b) `handleEntregaConfirm`**
- Passar `selected.perdas` como 3º arg em `todasCompletas(...)` (tanto no caminho completo quanto no parcial e no de partição), para o caso de já haver perda registrada.

**c) Tabela "Peças do Romaneio"**
- Novo estado visual roxo (`#9333ea` fundo, texto branco) quando `r < qtd` mas `r + perdaLinha ≥ qtd` e `perdaLinha > 0`. Texto `{r}/{qtd}` inalterado. Não mexer nos outros estados.

**d) Painel "Histórico"**
- Unificar `historico_recebimentos` + `historico_perdas` em lista única ordenada por `em` desc.
- Nova tag `perda` (vermelho/rosa) para itens de `historico_perdas`.
- `selectedHist` passa a aceitar união dos dois tipos; modal muda o título para "Peças perdidas" quando tipo = `perda`, mantendo a mesma tabela.
- Renomear a seção para "Histórico".

## Critério de aceite
1. Perda que zera todas as diferenças → status vira `Romaneio Completo` automaticamente, liberando "Confirmar conferência".
2. Cada registro de perda aparece no Histórico com tag própria, intercalado por data.
3. Linhas fechadas por perda aparecem em roxo mantendo `recebido/total`.
4. `cops.pecas` intacto; cálculo de pagamento inalterado.

# MAP — "Retingir" refletindo na programação de Tinturaria do PROD

Hoje o fluxo Corrigir → Retingir só marca a peça (`map_estoque_pecas`). O bloco Tinturaria do PROD continua contando a peça na cor antiga e nunca cria a linha da cor nova. Este plano corrige isso movendo 1 peça (e os kg proporcionais) da linha original para uma linha da cor nova.

## 1. Migration (somente aditiva)

Uma nova migration adicionando um único campo:

```sql
ALTER TABLE public.map_tinturaria_programacoes
  ADD COLUMN IF NOT EXISTS retingir_origem_id uuid NULL;
```

Sem FK, sem constraint, sem DROP/DELETE/RENAME. As policies atuais de `map_tinturaria_programacoes` já cobrem INSERT e UPDATE — nenhuma policy nova, nenhum GRANT novo (a tabela já é exposta).

## 2. `src/lib/map.ts`

- Adicionar `retingir_origem_id: string | null` à interface `MapProgramacaoTinturaria`.
- Adicionar uma função `retingirProgramacao(peca, corNova)` que executa, em sequência, os passos abaixo. Ela reaproveita o `patchProgramacao` existente e faz o insert da linha nova.

Lógica de rateio (por peça retingida, N = 1):

```text
razão_env = kg_enviados / pecas                (se pecas > 0, senão 0)
razão_rec = kg_recebidos / pecas_recebidas     (se pecas_recebidas > 0, senão 0)

linha original:  pecas -= 1
                 pecas_recebidas -= 1          (se não nulo e > 0)
                 kg_enviados  -= round(razão_env, 2)
                 kg_recebidos -= round(razão_rec, 2)   (se aplicável)
                 todos com clamp em 0 (nunca negativo)
```

Linha da cor nova — procura primeiro uma linha do mesmo `producao_id` com `retingir_origem_id = orig.id`, `cor = cor_nova`, `pecas_recebidas` nulo e `nota_fiscal_recebimento` nula:

- **Se existir:** `pecas += 1` e `kg_enviados += round(razão_env, 2)`.
- **Se não existir:** insere replicando da original — mesmo `producao_id`, mesma `tinturaria`, `data_programacao` = hoje, `cor` = cor nova, `pecas` = 1, `kg_enviados` = `round(razão_env, 2)`, e `kg_recebidos` / `pecas_recebidas` / `data_recebimento` / `nota_fiscal_recebimento` / `nota_cobertura` todos NULL (o usuário preenche ao receber), `retingir_origem_id` = id da original.

Assim a soma (original reduzida + nova) fecha com os totais anteriores do PROD.

## 3. `src/components/map/CorrigirPecaDialog.tsx`

No `confirmar()`, quando `tipo === "retingir"`:

1. Chamar `retingirProgramacao` antes (ou junto) do patch atual da peça.
2. Atualizar `programacao_id` da peça para o id da linha nova, para o badge "em correção" acompanhar a cor nova.
3. Gravar no evento `correcao_iniciada` (JSONB de histórico, sem migration) o campo extra `programacao_origem_id`.
4. Se o rateio falhar, avisar por toast e não deixar a peça em estado inconsistente.

`tipo === "retrabalhar"` fica **exatamente** como está — retrabalho não toca em programações.

## 4. Fora de escopo (não serão tocados)

`cop-saldos.ts`, `DevolucoesTab.tsx`, `ReceberPecaCorrigidaDialog.tsx`, `DevolverPecasDialog.tsx`, `TinturariaBlock.tsx` (as linhas novas aparecem sozinhas pela query existente), e qualquer arquivo de PCP ou COP. O filtro padrão "Todas" da aba Devoluções não muda. O recebimento da linha nova continua manual no bloco Tinturaria.

## 5. Critérios de aceite verificados

1. "amarelo · 4 pçs · 80 kg env · 81,6 kg rec · 4 pçs rec" → retingir 3 para preto: amarelo fica 1 pç / 20 kg env / 20,4 kg rec / 1 pç rec; preto novo 3 pçs / 60 kg env e demais vazios; soma do PROD idêntica.
2. Retingir 3 peças uma a uma para a mesma cor gera **uma** linha preta acumulando.
3. Peças seguem em Devoluções como "Aguardando retingir" até o Receber.
4. Nada existente deletado ou renomeado.

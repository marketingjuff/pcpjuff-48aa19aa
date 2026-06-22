## Etapa 1 — Fluxo de Refação + Reabrir para Expedição

### 1. Migração de banco
Nova migração SQL:
- `ALTER TABLE public.pedidos ADD COLUMN refacoes jsonb NOT NULL DEFAULT '[]'::jsonb;`
- Regenerar tipos (atualizar `src/integrations/supabase/types.ts` ou refletir via `schema-extras.ts` se for o padrão usado para extensões — vou adicionar `refacoes?: RefacaoEpisodio[]` em `schema-extras.ts` e no tipo `Pedido` em `src/lib/pedidos.ts`).

Tipo:
```ts
type RefacaoEpisodio = {
  etapa_origem: string;
  etapa_destino: "dados" | "arte" | "dtf" | "silk" | "acabamento";
  data: string;          // ISO
  quem: string;          // uuid
  pecas_refazer: number;
  perda_pecas: number;
  perda_adesivos: number;
  motivo: string;
  aberto: boolean;
};
```

### 2. `VoltarDropdown` → `RefazerDropdown`
- Renomear o label visível para **"Refazer pedido"** (botão "OK" vira "Refazer pedido"; mantém o `Select` de destino).
- Manter o nome do arquivo/componente para reduzir diff, apenas mudar o texto do botão.
- Nova prop opcional `pedido` para sabermos `tipo_estampa` e episódio aberto.
- Ao clicar:
  - Se NÃO houver episódio aberto (`refacoes.find(e => e.aberto)` ausente) → abrir modal de Refação.
  - Se houver episódio aberto → não abrir modal; apenas chamar `onVoltar(destino)` e atualizar o `etapa_destino` do episódio aberto.

### 3. Novo componente `RefacaoDialog`
Campos (todos validados):
- Etapa de destino (já vem do dropdown — exibido como confirmação).
- Quantas peças serão refeitas (number, obrigatório, ≥1).
- Houve perda de peças? Sim/Não → se Sim, quantas peças perdidas (number obrigatório).
- Houve perda de adesivos? (apenas se `tipo_estampa ∈ {"DTF","DTF+Silk"}`) → se Sim, quantos adesivos perdidos.
- Motivo (textarea, obrigatório, trim ≠ "").

Ao confirmar: chama callback `onConfirmar(payload)` que monta o episódio e dispara `onVoltar`.

### 4. Destinos ampliados
- `DTFTab`: `destinos={["dados","arte"]}`.
- `SilkTab`: `destinos={["dados","arte"]}`.
- `AcabamentoTab` / `ExpedicaoTab`: inalterados.

### 5. Integração nos handlers de Voltar (DTF, Silk, Acabamento, Expedição)
Cada `handleVoltar` existente passa a:
1. Determinar `etapaOrigem = calcularEtapaAtual(pedido).etapa.replace(/\*$/,"")`.
2. Buscar episódio aberto.
3. Caso haja → atualizar `refacoes` substituindo o episódio aberto com novo `etapa_destino`; manter o reset de campos já existente; **não** setar mais `reaberto: true` (ver §8).
4. Caso não haja → o `RefacaoDialog` já foi preenchido; criar novo episódio com `aberto: true`, `quem = (await supabase.auth.getUser()).data.user?.id`, `data = new Date().toISOString()`, e fazer `upsert.mutate({ id, refacoes: [...existing, novoEpisodio], <resets das etapas seguintes> })`.

O reset de campos das etapas seguintes (comportamento atual) é preservado.

### 6. Fechamento automático de episódio
Em `calcularEtapaAtual` (ou num helper chamado após upserts), quando a etapa atual recuperar e voltar a ser ≥ `etapa_origem` do episódio aberto, marcar `aberto:false`.

Implementação: criar helper `fecharEpisodiosResolvidos(pedido)` em `src/lib/pedidos.ts` que retorna o array `refacoes` atualizado. Disparar nos save handlers de DadosIn / Arte / DTF / Silk / Acabamento — quando a etapa atual do pedido (calculada sem `*`) for igual à `etapa_origem`, fecha. Para simplificar: chamar essa função na invalidação após cada upsert principal (DTF/Silk/Acabamento/etc.) — se mudou alguma flag de progresso e algum episódio precisa fechar, faz um update extra. Vou centralizar dentro do mesmo `upsert.mutate` desses handlers.

### 7. Asterisco = número de episódios
Em `calcularEtapaAtual` linha 225, substituir:
```ts
if (p.reaberto && etapa !== "Finalizado") etapa = `${etapa}*`;
```
por:
```ts
const n = Array.isArray(p.refacoes) ? p.refacoes.length : 0;
if (n > 0 && etapa !== "Finalizado") etapa = `${etapa}${"*".repeat(n)}`;
```
Remover a dependência de `reaberto` para o asterisco.

### 8. `reaberto` passa a significar só "reaberto do Finalizados"
- Remover `reaberto: true` dos handlers de Voltar (DTF/Silk/Acabamento/Expedição).
- Manter `reaberto: true` somente no fluxo `onReabrir` em `FinalizadosTab` (chamado de `routes/_authenticated/index.tsx`).

### 9. Reabrir Finalizados → Expedição
Atual:
```ts
upsert.mutate({ id, finalizado_em: null, reaberto: true })
```
Mudar para também garantir que ele apareça na Expedição. Como a `ExpedicaoTab` já filtra por `p.expedicao_entrou_em && !p.finalizado_em` (linha 69), basta o pedido ter `expedicao_entrou_em` preenchido — todo finalizado já passou por lá, então geralmente já tem. Não precisa zerar nada de produção. Confirmar: vou manter o payload `{ finalizado_em: null, reaberto: true }`; o pedido reaparece na Expedição automaticamente.

### 10. Aviso "em refação" nas abas operacionais
- Helper `temEpisodioAberto(p)` em `src/lib/pedidos.ts`.
- Em Arte/DTF/Silk/Acabamento (cabeçalho do card de detalhe e/ou linha da lista), exibir badge `<Badge variant="destructive">em refação</Badge>` quando `temEpisodioAberto(pedido)`.

### 11. Aba "Retrabalho" (admin/gestor)
Novo arquivo `src/components/pcp/RetrabalhoTab.tsx`, mesmo padrão visual de `DashboardTab`:
- Cards de totais: peças refeitas (soma `pecas_refazer`), peças perdidas, adesivos perdidos, % retrabalho (refeitas ÷ Σ `qtde_pedido_total` dos pedidos), etapa de origem com maior soma de perdas.
- Tabela de pedidos com `refacoes.length > 0`; expandir cada um para listar episódios com todos os campos.
- Edição inline de episódio e botão Apagar episódio. Atualiza `refacoes` via `upsert`.

Em `src/routes/_authenticated/index.tsx`, adicionar a aba "Retrabalho" usando `isManager` (igual a Finalizados). Filtros padrão de tabela como nas outras abas.

### 12. Observações
- Não tocar em trava/bloqueio por etapa (Etapa 2).
- Não duplicar pedidos.

### Arquivos afetados
- nova migração SQL (coluna `refacoes`)
- `src/integrations/supabase/schema-extras.ts`, `src/lib/pedidos.ts` (tipo `Pedido`, asterisco, helpers)
- `src/components/pcp/VoltarDropdown.tsx` (label + integração com dialog)
- novo `src/components/pcp/RefacaoDialog.tsx`
- `src/components/pcp/DTFTab.tsx`, `SilkTab.tsx`, `AcabamentoTab.tsx`, `ExpedicaoTab.tsx` (destinos, handlers, badge)
- `src/components/pcp/ArteTab.tsx` (badge "em refação")
- `src/components/pcp/FinalizadosTab.tsx` / `routes/_authenticated/index.tsx` (Reabrir comportamento + nova aba Retrabalho)
- novo `src/components/pcp/RetrabalhoTab.tsx`

Aguardo aprovação para implementar.
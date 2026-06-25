## Parte 1 — Histórico da Data de Entrega

**Migration (Supabase)**
- Adiciona coluna `pedidos.historico_data_entrega jsonb NOT NULL DEFAULT '[]'`.
- Cria função `registrar_alteracao_data_entrega()` (SECURITY DEFINER, search_path = public): em UPDATE, se `data_entrega` mudou e a antiga não era nula, empilha `{data: OLD.data_entrega, em: now(), por: auth.uid()}`.
- Cria trigger `trg_hist_data_entrega` BEFORE UPDATE em `public.pedidos`.
- Regenera os types do Supabase (a coluna aparece como `Json` no tipo `Pedido`).

**Front — `FinalizadosTab.tsx`**
- Importar `useProfilesMap` e `resolveNome` de `@/hooks/use-profiles-map`.
- No painel Histórico, **logo abaixo** do `ReadOnlyField` "Entrega" (linha 191), renderizar o bloco "Histórico de Data de Entrega" apenas quando `historico_data_entrega` tiver ≥ 1 item.
- Sequência exibida: todas as datas antigas (na ordem do array) + `historico.data_entrega` atual no fim.
- Cada linha: `Nª: <data BR>`; da 2ª em diante adiciona ` — alterada em <data BR> por <nome>` (meta vem do item anterior do array, que é o carimbo da troca que gerou aquela data). Última linha recebe sufixo `(atual)`.
- Não alterar nada que grava `data_entrega` — o trigger cuida.

## Parte 2 — Botão "Duplicar pedido" (Dados In)

**`DadosInTab.tsx`**
- Importar ícone `Copy` de `lucide-react`.
- Na toolbar, **entre "Novo" e "Deletar"**, adicionar:
  ```tsx
  {selected && (
    <Button size="sm" variant="outline" onClick={handleDuplicar}>
      <Copy className="h-4 w-4 mr-1" />Duplicar
    </Button>
  )}
  ```
  Visível para todos os perfis (não usar `podeDeletar`).
- Implementar `handleDuplicar()` conforme spec: `onSelect(null)` + `setForm({ ...empty, <campos brancos> })`.

**Campos mantidos do `selected`:**
- Vendedor: `orcamento`, `vendedor`, `frete`, `tempo_frete`, `uf_entrega`, `necessita_vetorizacao`, `obs_vendedor`, `layout_url`, `data_entrega`.
- Produção: `status_pecas` (default `"incompleto"`), `tipo_estampa` (default `""`), `dias_secagem`, `arte_data`, `inicio_estamparia`, `termino_estamparia`, `termino_acabamento`, `observacoes_pedido`.

**Campos zerados:**
- Vendedor: `pedido_olist=""`, `qtd=null`, `forma_pagamento=null`, `nf_emitida=null`.
- Produção: `n_batidas_dtf=null`, `n_batidas_silk=null`.
- `entrada_pedido` = hoje (`YYYY-MM-DD`).
- Todos os demais campos de execução (arte/dtf/silk/acabamento/expedição/refacoes/historico/reaberto/etc.) ficam com default por estarem fora da lista branca.

**Sem alterações em:** lógica de gravação de `data_entrega`, fluxo "Solicitar Alteração de Data", RLS, `DataEntregaField` (novo pedido sem `id` já cai no caminho de edição direta), `checkDuplicado` no save (Olist único).

## Arquivos tocados
- `supabase/migrations/<timestamp>_historico_data_entrega.sql` (novo)
- `src/components/pcp/FinalizadosTab.tsx`
- `src/components/pcp/DadosInTab.tsx`

## Modelo de dados

**Migration SQL** (nova):
- `ALTER TABLE public.pedidos ADD COLUMN pecas_solicitadas jsonb NOT NULL DEFAULT '[]'::jsonb;`
- Function + trigger `BEFORE INSERT OR UPDATE ON pedidos`:
  - Se `pecas_solicitadas` é array não vazio:
    - se todos itens têm `(qtd_enviada)::int >= (qtd)::int` → `NEW.status_pecas := 'completo'`
    - senão → `NEW.status_pecas := 'incompleto'`
  - Se vazio → não altera `status_pecas`.

## Tipos

`src/lib/pedidos.ts`:
- Novo tipo `PecaSolicitada = { modelo: string; cor: string; tamanho: string; qtd: number; qtd_enviada: number }`.
- Campo `pecas_solicitadas?: PecaSolicitada[]` em `Pedido`.

`src/integrations/supabase/schema-extras.ts`:
- Campo `pecas_solicitadas: PecaSolicitada[] | null` em `PedidoExtras` (import do tipo).

## Cores configuráveis

`src/hooks/use-color-settings.ts`:
- `BotaoKey` += `"solicitar_pecas" | "pedido_completo"`.
- `DEFAULT_BOTAO_COLORS`:
  - `solicitar_pecas: { bg: "#503c82", fg: "#ffffff" }`
  - `pedido_completo: { bg: "#00894e", fg: "#ffffff" }`
- Atualizar o loop em `mergeSettings` para incluir as duas chaves.

`src/routes/_authenticated/configuracoes.tsx` (`CoresTab`):
- Adicionar 2 linhas: "Solicitar Peças" e "Pedido Completo" no painel de botões.

## Componente novo

`src/components/pcp/SolicitarPecasDialog.tsx`:
- Props: `pedido`, `open`, `onOpenChange`, `onSave(next: PecaSolicitada[])`, `readOnly?: boolean`.
- Reusa `REFACAO_MODELOS/CORES/TAMANHOS`, `corHex`, `corTextoSobre` do `PecasPerdidasEditor`.
- Linhas com dropdowns Modelo / Cor / Tamanho + input numérico `qtd`. Adicionar/remover linhas.
- Por linha, exibir status: **solicitado** (`qtd`) × **enviado** (`qtd_enviada`) × **pendente** (`qtd - qtd_enviada`) com chips de cores distintas.
- Modo read-only quando "tudo enviado": sem botões adicionar/remover, inputs disabled.
- PCP nunca edita `qtd_enviada` — campo só de leitura no dialog.

## Integração no `DadosInTab`

`src/components/pcp/DadosInTab.tsx`:
- Helpers locais:
  ```ts
  const lista = form.pecas_solicitadas ?? [];
  const temSolicitacao = lista.length > 0;
  const temPendencia = lista.some(p => (p.qtd_enviada ?? 0) < p.qtd);
  const tudoEnviado = temSolicitacao && !temPendencia;
  ```
- Mostrar o botão **logo após** o bloco "Observações de produção" (após linha 616, antes do bloco com `UpdateButton`), quando `form.status_pecas === "incompleto"` OU `temSolicitacao`.
- 3 estados:
  1. Incompleto sem solicitação → bg `solicitar_pecas`, texto "Solicitar Peças".
  2. Incompleto com solicitação → mesmo botão roxo (mesmo texto).
  3. Tudo enviado → bg `pedido_completo`, texto "Pedido Completo", abre dialog em read-only.
- Clique abre `SolicitarPecasDialog`. Ao salvar:
  - Atualiza `form.pecas_solicitadas` (mantém UX dirty) **e** persiste imediatamente via `onSave({ id, pecas_solicitadas: next })` para a trigger calcular `status_pecas`. Refetch atualiza o `selected`.
- Dropdown "Status de Peças" recebe `disabled={temPendencia}` para travar em "incompleto" enquanto há pendência (a trigger é o source of truth; o disable é UX).
- Incluir `pecas_solicitadas` no `setForm` que hidrata de `selected` (linha ~306) e no payload de `saveProducao` / `saveVendor` quando relevante (apenas saveProducao precisa enviar).

## Restrições respeitadas

- Só Input de Produção alterado; Input de Vendedor intocado.
- `pecas_perdidas` / refação não alteradas.
- Save nunca bloqueado; gates só afetam visibilidade e o disable do select de status.
- Sem validação de formato; quantidades manuais.

## Arquivos tocados

- `supabase/migrations/<novo>.sql` (coluna + trigger)
- `src/lib/pedidos.ts`
- `src/integrations/supabase/schema-extras.ts`
- `src/hooks/use-color-settings.ts`
- `src/routes/_authenticated/configuracoes.tsx`
- `src/components/pcp/SolicitarPecasDialog.tsx` (novo)
- `src/components/pcp/DadosInTab.tsx`

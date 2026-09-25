# Corrigir etapa na Expedição e conserto do botão no Acabamento

Sem migração, sem SQL. Apenas os 4 arquivos da allowlist.

## 1. src/components/pcp/AcabamentoTab.tsx
- Linha 277: `acabamentoCompleto(selected)` passa a `acabamentoPronto(selected)`.
- Nada mais muda. Se `acabamentoCompleto` ficar sem uso no arquivo, remover só esse nome do import (linha 4).

## 2. src/components/pcp/CorrigirEtapaButton.tsx
- Novo `export type CorrigirAbaOrigem = CorrecaoEtapa["aba_origem"] | "expedicao";`
- Prop `abaOrigem: CorrigirAbaOrigem`.
- Em `entrada`: `aba_origem: abaOrigem as CorrecaoEtapa["aba_origem"]`. Nada mais muda.

## 3. src/routes/_authenticated/index.tsx
- Adicionar `canManage={isManager}` no `<ExpedicaoTab ... />`. Nada mais muda.

## 4. src/components/pcp/ExpedicaoTab.tsx
- `Props` ganha `canManage?: boolean`; assinatura recebe `canManage = false`.
- Importar `CorrigirEtapaButton` e `tipoIncluiDTF`, `tipoIncluiSilk` de `@/lib/pedidos`.
- Estado `corrigirDestino` (padrão "acabamento").
- Destinos, nesta ordem: acabamento; dtf (se inclui DTF); silk (se inclui Silk); arte; dados ("Input de Produção").
- Na linha de ações, à direita do `VoltarDropdown`: `Select` h-9 w-[210px] com "Corrigir para X" + `CorrigirEtapaButton` (`abaOrigem="expedicao"`, `onSave={onSave}`, `onCorrigido` navega com acabamento -> "acab").
- Exibido só quando `canManage && !soLeitura && selected && selected.expedicao_entrou_em && !selected.finalizado_em`.
- Se o destino escolhido deixar de ser válido ao trocar de pedido, volta para "acabamento".
- `VoltarDropdown`, finalização, dashboard e estilos intocados.

## Ao final
Typecheck (`bunx tsgo --noEmit`) e diff dos 4 arquivos.

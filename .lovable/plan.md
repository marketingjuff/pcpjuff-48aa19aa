## Problema

Hoje o botão **Refazer pedido** (componente `VoltarDropdown`) só aparece quando `!readOnly`. Quando a etapa já foi concluída (e fica bloqueada para edição), o botão somo. Nas abas DTF / Silk / Acabamento ele também está dentro do `<fieldset disabled={readOnly}>`, então mesmo que fosse renderizado ficaria desabilitado.

## Mudança

Tornar o **Refazer** sempre visível e clicável nas abas operacionais, independentemente do `readOnly` da etapa. Travar edição continua valendo só para os campos de execução — o Refazer é uma ação separada (gestores/operadores autorizados podem corrigir um pedido já finalizado naquela etapa).

### Arquivos afetados

1. **`src/components/pcp/DTFTab.tsx`**
   - Mover `<VoltarDropdown ...>` para fora do `<fieldset disabled={readOnly}>`.
   - Remover a condição `!readOnly &&` que envolve o `VoltarDropdown`.

2. **`src/components/pcp/SilkTab.tsx`**
   - Idem: tirar do fieldset e remover o gate `!readOnly`.

3. **`src/components/pcp/AcabamentoTab.tsx`**
   - Idem: o `AcabamentoVoltar` (que renderiza `VoltarDropdown`) sai do fieldset e perde o gate `!readOnly`.

4. **`src/components/pcp/ExpedicaoTab.tsx`**
   - Já renderiza o `VoltarDropdown` sem gate por readOnly (Expedição não usa `isReadOnly`). Sem alteração.

5. **`src/components/pcp/ArteTab.tsx`**
   - Hoje a aba Arte **não tem** botão Refazer. Confirmar antes se quer também adicionar lá (destinos só "dados") ou se a frase "nas abas" se refere apenas a DTF/Silk/Acabamento/Expedição.

### Comportamento mantido

- A trava de edição dos campos da etapa continua igual (fieldset disabled cobre os inputs).
- O `VoltarDropdown` já lida internamente com permissões via `useColorSettings` e o `RefacaoDialog`; quem dispara já é a pessoa autorizada da aba.
- Nada muda no fluxo de refação em si (snapshots, wipe de campos, etc.).

## Pergunta aberta

Quer que eu **também** adicione o botão Refazer na aba **Arte** (que hoje não tem nenhum)? Se sim, com qual destino — apenas "Dados In"?

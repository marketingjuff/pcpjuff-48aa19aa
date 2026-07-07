## Plano — Corrigir botões encavalados (MAP > Programação de Fios)

### Arquivo tocado
- `src/components/map/ProgramacaoFiosTab.tsx` (único)

Sem alteração de banco, sem tocar em cálculo de status (FIO/MALHARIA/TINTURARIA), sem mexer em `map_config`/cores, sem tocar nada fora de `src/components/map/`.

### Diagnóstico
A célula de ações renderiza até 4 botões com texto (`Finalizar`, `Editar`, `Devolução`, `Excluir`) com larguras fixas somando ~320px + gaps. Em zoom/telas menores, a coluna encolhe e os botões se sobrepõem.

### Solução proposta — icon buttons sempre visíveis
Converter os 4 botões para **icon buttons quadrados** (`h-7 w-7`, sem texto), com `title` + `aria-label` para acessibilidade e tooltip nativo. Mesmas cores/semântica de hoje. Sem dropdown de overflow — 4 ícones cabem em qualquer resolução de desktop e o alinhamento fica trivial.

Ícones (lucide, já importados/disponíveis):
- **Finalizar** → `CheckCircle2` — botão verde (`bg-emerald-600`), fica `disabled` (opacidade reduzida) quando `!canFinalize`. **Sempre renderizado** quando não-finalizado, para manter o alinhamento da coluna.
- **Editar** → `Pencil` — `variant="outline"`.
- **Devolução** → `Undo2` — `variant="outline"`.
- **Excluir** → `Trash2` — `variant="ghost"` com `text-destructive`; só aparece se `canManageMap` (mantém a trava do Plano 1 do MAP).
- **Reabrir** (linha finalizada, só admin/gestor MAP) → segue como `RotateCcw` icon-only também, para consistência.

### Layout da célula
- Container: `flex items-center justify-end gap-1` (já é).
- Cada botão: `h-7 w-7 p-0 shrink-0` com o ícone em `h-3.5 w-3.5`.
- `td`: adicionar `min-w-[140px]` para reservar espaço confortável dos 4 ícones + gaps e evitar que o browser encolha a coluna.
- Remover as larguras fixas por texto (`w-[88px]`, `w-[72px]`, `w-[80px]`).

### Comportamento
- Zero mudança de lógica: `finalizar`, `openEditar`, `setDevProd`, `excluirProd`, `reabrir`, `canFinalize`, `canManageMap` seguem idênticos.
- Botão Finalizar continua `disabled={!canFinalize}` com o mesmo verde e opacidade quando desabilitado.

### Fora do escopo
- Dropdown de overflow (item 4 do prompt): **não vou implementar** — com icon buttons de 28px, os 4 cabem sem risco. Se depois de aprovado você quiser overflow em uma faixa específica, faço num plano separado.
- Qualquer outro arquivo, banco ou lógica de cálculo.

### Critério de pronto
- Nenhuma sobreposição em qualquer largura de desktop.
- Coluna alinhada linha a linha (Finalizar sempre presente quando não-finalizado, mesmo desabilitado).
- Tooltip nativo ao passar o mouse com o nome completo da ação.
- Trava do `canManageMap` para Excluir/Reabrir preservada.

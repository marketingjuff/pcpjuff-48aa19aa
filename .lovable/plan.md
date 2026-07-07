## Plano 1 de 2 — MAP: restringir "Reabrir" e "Excluir" a Admin + Gestor MAP

Escopo estrito do Prompt 1. Sem alteração de banco. Depois que este for aprovado/implementado, envio o Plano 2 (PCP "Corrigir etapa").

### Arquivo tocado
- `src/components/map/ProgramacaoFiosTab.tsx` (único)

### Mudanças
1. **Import novo**: `import { useCanAccessMap } from "@/hooks/use-role";` (hook já existe e resolve exatamente `admin OR (gestor com area_extra "map")`, mesmo padrão do COP).
2. **Chamada do hook** dentro do componente:
   ```ts
   const canManageMap = useCanAccessMap();
   ```
3. **Trava dupla nas duas ações** (UI + handler), sem tocar em mais nada:
   - `reabrir(prod)`: early-return no início do handler se `!canManageMap` (com `toast.error("Sem permissão.")` no mesmo estilo já usado no arquivo). O botão "Reabrir" (linha ~374) só renderiza se `canManageMap`.
   - `excluirProd(prod)`: mesmo tratamento — early-return no handler + botão/ícone de excluir só renderiza se `canManageMap`.
4. **Nada mais muda**: `finalizar()`, botão "Devolução", inputs inline, layout, tamanhos, cores — tudo intocado. As mudanças recentes de tamanho dos botões `Finalizar`/`Devolução` continuam como estão.

### Fora do escopo (não vou tocar)
- Qualquer outro componente de `src/components/map/`.
- `src/lib/map.ts`, `src/hooks/use-role.ts`, PCP, COP.
- Banco: nenhuma migração.

### Critério de pronto
- Usuário MAP comum: sem botão "Reabrir" e sem botão de excluir na aba.
- Admin / Gestor com área `map`: comportamento idêntico ao atual.
- Mesmo que alguém force o handler, o early-return bloqueia a execução.
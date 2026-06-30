## Aba Corte — encolher Modelo/Cor e ampliar campos de tamanho

**Arquivo:** `src/components/cop/CorteTab.tsx` (linhas 377-381 e 418-428)

**Mudanças no `<thead>`/`<td>` da tabela de "Descrição dos produtos":**

1. Modelo: `min-w-[180px]` → `w-[90px] min-w-[90px]` (metade do atual)
2. Cor: `min-w-[140px]` → `w-[70px] min-w-[70px]` (metade do atual)
3. Tamanhos (PP, P, M, G, GG, EXG, EXXG): `w-[70px]` → `w-[72px] min-w-[72px]` + Input com `className="h-8 text-center px-1 tabular-nums w-full"` para garantir espaço para 4 dígitos sem que as setinhas de spinner do `type="number"` cortem o conteúdo.

Sem mudanças funcionais — apenas larguras de coluna e padding do input numérico.

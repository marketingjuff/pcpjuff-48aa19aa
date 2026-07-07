## Ajuste de cores/exibição na aba Disponível (COP)

### Escopo
- Único arquivo: `src/components/cop/DisponivelTab.tsx`
- Único trecho: cálculo de `color` e `display` dentro do `REFACAO_TAMANHOS.map` (linhas ~186-192)
- 100% front-end. Sem banco, sem migration, sem toque no Supabase.

### Regra nova
- Vermelho **só** para `v < 0`.
- Positivo/zero com faltante pendente → **cinza** (`text-gray-500`), mostrando o número.
- Saldo `0` sem faltante → exibir **`—`** (em vez de `0` laranja).
- Célula sem presença → segue `—` em `text-muted-foreground`.

### Alteração exata
Substituir:
```tsx
const presente = prod > 0 || falt > 0 || baix > 0;
const temFalta = presente && falt > 0;
const color = !presente ? "text-muted-foreground"
            : temFalta ? "text-red-700"
            : v < 0 ? "text-red-700"
            : v === 0 ? "text-amber-700"
            : "text-green-700";
const display = !presente ? "—" : v;
```
Por:
```tsx
const presente = prod > 0 || falt > 0 || baix > 0;
const temFalta = presente && falt > 0;
const color = !presente ? "text-muted-foreground"
            : v < 0 ? "text-red-700"
            : temFalta ? "text-gray-500"
            : v === 0 ? "text-muted-foreground"
            : "text-green-700";
const display = (!presente || (v === 0 && !temFalta)) ? "—" : v;
```

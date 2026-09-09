# MAP — Malharia por entrega + linha do PROD congelada

Duas mudanças na aba "Prod. de Tecido" do MAP, exatamente conforme o documento enviado.

## 1. Malharia passa a ser escolhida por entrega

- O seletor de Malharia sai do topo do bloco; o topo fica só com o rótulo e o "Total recebido".
- A tabela de entregas ganha "Malharia" como primeira coluna, uma escolha por linha.
- Cada entrega nova já nasce com **Mavelo** selecionada; se o PROD já tinha uma malharia definida e ela existe na lista, essa ganha prioridade.
- O botão "Entrega" continua sempre disponível, mesmo sem malharias cadastradas.
- Entregas já existentes passam a mostrar a malharia que estava gravada no PROD (preenchimento único, sem apagar nada).
- Valores fora da lista aparecem como "(legado)" e não desaparecem.
- Com PROD finalizado, a malharia aparece como texto, sem edição.
- Quebra, "Dar baixa" e "Desfazer baixa" seguem iguais.

## 2. Linha de resumo do PROD congelada

- Ao expandir um PROD e rolar, a linha de resumo dele fica travada logo abaixo do cabeçalho, com fundo amarelo sólido.
- Com vários PRODs abertos, ao descer a linha do PROD seguinte entra por cima; ao subir, volta a anterior.
- Quando o conteúdo do PROD termina, a linha dele solta.
- PRODs fechados nunca ficam congelados; o cabeçalho continua por cima.

## Detalhes técnicos

**Migração** (arquivo novo em `supabase/migrations/`), somente o SQL do documento:

```sql
ALTER TABLE public.map_malharia_entregas
  ADD COLUMN IF NOT EXISTS malharia text;

UPDATE public.map_malharia_entregas e
SET malharia = p.malharia
FROM public.map_producoes p
WHERE e.producao_id = p.id
  AND e.malharia IS NULL
  AND p.malharia IS NOT NULL;
```

Sem DROP/DELETE/TRUNCATE, sem policy nova, sem trigger novo, sem tocar em `map_producoes.malharia`.

**`src/lib/map.ts`** — adicionar `malharia: string | null` em `MapEntregaMalharia`. Nada mais.

**`src/components/map/MalhariaBlock.tsx`** — remover o `<Select>` do cabeçalho (inclusive o ramo `readOnly`) e as órfãs `malhariaAtual`, `malhariaLegado`, `commitMalharia`; manter os imports de `patchProducao` e `useAppList`. Adicionar `pickDefaultMalharia()` (prioriza a malharia do PROD se existir na lista, senão "mavelo" case-insensitive, senão a primeira) e usá-la no insert de `addEntrega`. Novo `colgroup` de 7 colunas (18/17/10/10/20/19/6), `min-w-[820px]`, `<th>Malharia</th>` primeiro, `colSpan={7}` no "Sem entregas.", e a célula com `Select` (h-7, opção "(legado)") gravando via `commit(e.id, "malharia", …)`.

**`src/styles.css`** — novo `@layer base` após a regra existente do `.tbl-congelada thead th`, com `tr.map-prod-congelada > td` em `position: sticky; top: var(--map-prod-top, 28px); z-index: 15;` e fundo amarelo sólido. A regra existente não muda.

**`src/components/map/ProgramacaoFiosTab.tsx`** — trocar o `<tbody>` único + `Fragment` por um `<tbody key={prod.id}>` por PROD (necessário para o sticky soltar no fim do PROD), remover o import de `Fragment` se ficar sem uso, aplicar `map-prod-congelada` e `bg-yellow-100` sólido só quando aberto, e extrair o bloco do grupo para um componente interno no mesmo arquivo com refs no `<thead>` e no container de rolagem, medindo a altura via `useLayoutEffect` + `ResizeObserver` e gravando `--map-prod-top` no container. Filtros, ordenação, zebrado, realtime e o foco por `prodId` ficam intactos.

Arquivos tocados: só a migração nova, `src/lib/map.ts`, `MalhariaBlock.tsx`, `ProgramacaoFiosTab.tsx`, `src/styles.css`. Ao final, rodo o typecheck e mostro o resultado.

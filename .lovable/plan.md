# Plano: cabeçalho congelado na tabela de Romaneios (piloto)

## Escopo
- Congelar a linha de cabeçalho da tabela principal de romaneios em `src/components/cop/RomaneioTab.tsx`.
- Nenhuma outra tabela do sistema será alterada neste piloto.
- Nenhuma mudança de lógica, cálculo, ordenação, agrupamento, seleção, schema ou banco de dados.

## Arquivos que serão tocados
1. `src/styles.css` (apenas adição no final do arquivo)
2. `src/components/cop/RomaneioTab.tsx` (apenas uma linha no `return` de `RomaneioPecasTable`)

## Alteração 1 — `src/styles.css`

### Onde
- No final do arquivo, após o fechamento do `@layer base` (linha 194 atualmente).
- Fora de qualquer `@layer`, `@theme`, `@import` ou `@custom-variant`.

### Conteúdo a adicionar
```css
/* Cabeçalho de tabela congelado (linha 1 travada, estilo Google Sheets).
   Aplicar a classe no <div> que envolve a <table> e que tem overflow/max-height. */
.tbl-congelada thead th {
  position: sticky;
  top: 0;
  z-index: 20;
  background-color: var(--color-muted);
  box-shadow: inset 0 -1px 0 var(--color-border);
}
```

### Justificativa das propriedades
- `position: sticky; top: 0` no `th`: ancorar cada célula do cabeçalho no topo do contêiner de rolagem. Sticky no `thead` é inconsistente entre navegadores.
- `z-index: 20`: garantir que os cabeçalhos fiquem acima das linhas de dados ao rolar.
- `background-color: var(--color-muted)`: fundo opaco. Hoje o `thead` usa `bg-muted/40` (translúcido) e as linhas do `tbody` usam `bg-muted/80` no zebrado. Sem fundo opaco, as linhas de dados apareceriam por trás do cabeçalho congelado.
- `box-shadow: inset 0 -1px 0 var(--color-border)`: substitui a borda inferior que desaparece quando `th` fica sticky em tabela com `borderCollapse: "collapse"`. Mantém a linha divisória sutil.
- Uso de `var(--color-muted)` e `var(--color-border)`: variáveis já existem no `@theme inline` e funcionam em ambos os temas (claro e escuro).
- Nenhuma declaração de `overflow` ou `overscroll-behavior`: o overflow vertical fica por conta das classes Tailwind no `div`, e o encadeamento de rolagem permanece padrão (ao chegar ao fim da tabela, a roda do mouse volta a rolar a página).

## Alteração 2 — `src/components/cop/RomaneioTab.tsx`

### Onde
- Dentro do `return` do componente `RomaneioPecasTable` (componente interno no arquivo, que começa por volta da linha 1333).
- O `div` que envolve a `<table>` com as classes `overflow-x-auto`, `rounded-md`, `border`.

### Mudança
De:
```tsx
<div className="overflow-x-auto rounded-md border">
  <table ...>
```

Para:
```tsx
<div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-18rem)] rounded-md border tbl-congelada">
  <table ...>
```

### Por que essa classe de altura
- A solução correta e compatível com todos os navegadores para manter o `sticky` do cabeçalho funcionando junto com rolagem horizontal é dar ao contêiner uma **altura máxima com rolagem vertical própria**.
- Sem isso, o `overflow-x: auto` computa `overflow-y: auto` implicitamente, transformando o `<div>` em um contêiner de rolagem em ambos os eixos. Com a altura natural do contêiner igual à altura total da tabela, o `sticky` do `th` nunca entra em ação porque o contêiner não rola verticalmente.
- `max-h-[calc(100vh-18rem)]` deixa a tabela ocupar a maior parte da altura da viewport, garantindo espaço para rolagem vertical real dentro do contêiner, sem empurrar a página para além do viewport.
- O valor `18rem` reserva espaço para o header fixo, abas, filtros e ações acima da tabela, mantendo a tabela visível e utilizável.

### O que NÃO será alterado neste arquivo
- Estrutura do `<table>`, `<thead>`, `<tbody>`.
- Componente `SortableTh` e comportamento de ordenação (`toggleSort`).
- `useMemo` de `tamanhosColunas`, `linhas` ou qualquer lógica de cálculo/ordenação/agrupamento/seleção.
- Larguras de coluna.
- Eventos de clique para seleção de linha.
- Cores, paleta ou tema.

## Validação esperada após implementação
1. Abrir COP → aba Romaneio com a lista carregada.
2. Rolar para baixo dentro da tabela: a linha de cabeçalho deve permanecer visível e legível no topo, com fundo opaco e nenhuma linha de dados aparecendo por trás.
3. Rolar para a direita: as colunas de tamanhos devem continuar rolando normalmente na horizontal, com o cabeçalho acompanhando.
4. Clicar nos cabeçalhos ordenáveis (Romaneio, Oficina, Status, Recebimento): a ordenação deve continuar funcionando.
5. Selecionar uma linha: a seleção e o destaque devem continuar funcionando.
6. Verificar no tema escuro, se aplicável.

## Arquivos protegidos (não serão tocados)
- `src/lib/cop-saldos.ts`
- Qualquer outro componente do COP, PCP ou MAP
- Qualquer arquivo de schema, migration, policy ou query de banco de dados

## Garantias
- Nenhuma migration de banco de dados.
- Nenhuma alteração de lógica de negócio.
- Apenas uma tabela recebe a classe `tbl-congelada` neste piloto.
- Classes Tailwind adicionadas apenas no `div` envolvente da tabela de romaneios.
- Classe utilitária CSS adicionada no final de `src/styles.css`, sem reordenar ou modificar as regras existentes.
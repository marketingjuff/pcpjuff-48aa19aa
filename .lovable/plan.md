## Objetivo
Padronizar todos os calendários (date pickers) do app para:
1. Exibir iniciais dos dias da semana em **português** (Dom, Seg, Ter, Qua, Qui, Sex, Sáb).
2. Marcar com **fundo cinza médio** os dias que não são úteis (sábado, domingo e feriados cadastrados em `feriados`).

A mudança fica centralizada no componente base `src/components/ui/calendar.tsx`, então vale automaticamente para qualquer date picker existente ou futuro que use esse Calendar (todos usam, via `DateInputBR`).

## Mudanças

### 1. `src/components/ui/calendar.tsx` — localização PT-BR + modificador "não útil"
- Importar `ptBR` de `date-fns/locale` e passar `locale={ptBR}` ao `DayPicker`.
- Adicionar `formatters.formatWeekdayName` retornando a inicial em PT-BR (Dom/Seg/Ter/Qua/Qui/Sex/Sáb) — garante a abreviação correta mesmo quando o locale devolve "qua.".
- Aceitar uma nova prop opcional `holidays?: Set<string>` (datas ISO `yyyy-mm-dd`).
- Definir `modifiers={{ naoUtil: (date) => isWeekend(date) || holidays.has(isoLocal(date)) }}` combinado com quaisquer modifiers passados pelo chamador.
- Adicionar `modifiersClassNames={{ naoUtil: "bg-muted-foreground/20 text-foreground" }}` (cinza médio, legível em claro/escuro) — mesclando com classNames já recebidos.
- Não alterar comportamento de seleção/today; o estilo de selecionado continua sobrescrevendo o cinza.

### 2. `src/components/ui/date-input.tsx` — propagar feriados para o Calendar
- Usar o hook `useFeriados()` (já existente) dentro de `DateInputBR` para obter o `Set` de feriados.
- Passar `holidays={feriados}` ao `<Calendar />`.
- Manter o highlight cinza já existente no `<Input>` quando a data digitada cai em fim de semana, e estendê-lo para considerar feriados também (mesma fonte de verdade) — mantém consistência entre input e popover.

## Por que isso cobre "qualquer quadro existente ou futuro"
Todos os date pickers do projeto passam pelo `Calendar` base de `components/ui/calendar.tsx` (shadcn). Os inputs de data BR usam `DateInputBR`, que já é o wrapper padrão. Centralizando a lógica nesses dois arquivos, qualquer novo campo de data herda o comportamento sem trabalho adicional.

## Itens fora do escopo
- Não alterar a tabela `feriados` nem o hook `useFeriados`.
- Não mexer em estilos de cards/tabelas (apenas no calendário do popover e no input já existente).
- Não trocar a biblioteca `react-day-picker`.

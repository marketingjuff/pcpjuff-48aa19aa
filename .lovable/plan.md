## Resumo dos ajustes na aba Arte e no Dashboard Master

### 1. Botão "Baixar layout" não trava mais nada (ArteTab.tsx)
- Remover o estado `layoutBaixado` e a variável `camposLiberados`.
- Os campos editáveis (DTF, Silk, Status da Arte, Observações, botão Salvar) passam a ser renderizados sempre que houver um pedido selecionado.
- Remover a mensagem "Baixe o layout para liberar os campos abaixo."
- O botão "Baixar layout" continua existindo, mas é puramente um download — não muda nenhum estado.

### 2. Valor padrão "Selecione…" em todos os campos (todas as abas)
Auditar e ajustar todos os `<Select>` em:
`ArteTab.tsx`, `DTFTab.tsx`, `SilkTab.tsx`, `AcabamentoTab.tsx`, `ExpedicaoTab.tsx`, `DadosInTab.tsx`, `FinalizadosTab.tsx`.

Regras aplicadas a cada Select editável (Sim/Não, Vetorização DTF, Vetorização Silk, Status da Arte, Status das Peças, Tipo de Estampa, Vendedor, UF, Frete, Forma de Pagamento, Quem Bateu DTF/Silk, Responsável Acabamento, NF Emitida, todos os Sim/Não da Expedição etc.):
- `value` começa em `""` quando o registro não tem valor (não pré-seleciona "Sim", "Não" nem nenhuma opção).
- `<SelectValue placeholder="Selecione..." />` em todos.
- Garantir que `"Selecione..."` NÃO existe como `<SelectItem>` — só como placeholder.
- Filtros do dashboard continuam com "Todos" (não são entradas de dados, não entram nessa regra).

### 3. "Sim" sem data = inválido — DTF Impresso, DTF Cortado e Fotolito (ArteTab.tsx)
- Em `handleSave()`, validar antes de chamar `onSave`:
  - Se `dtf_impresso === "Sim"` e `dtf_executado` vazio → toast de erro e abortar.
  - Se `dtf_cortado === "Sim"` e `dtf_cortado_data` vazio → toast de erro e abortar.
  - Se `fotolito_impresso === "Sim"` e a nova data de impressão do fotolito estiver vazia → toast de erro e abortar.
- A regra atual de "Sim → Não limpa a data" (`setSimNaoComData`) já existe e será mantida; também aplicada ao novo campo de fotolito.

### 4. Fotolito — renomear "Executado" para "Data de Impressão do Fotolito" (ArteTab.tsx + pedidos.ts)
- Substituir o Select "Fotolito Executado" por um `DateInputBR` chamado **"Data de Impressão do Fotolito"**.
- A coluna do banco `fotolito_executado` (text) passa a guardar a data em ISO `YYYY-MM-DD` (reuso da coluna, sem migration). Onde ela é lida hoje como `"Sim"`, ajustar para:
  - `fotolitoFinalizadoArte(p)` → `p.fotolito_impresso === "Sim" && !!p.fotolito_executado` (qualquer string não vazia conta como data preenchida).
  - `fotolitoFinalizadoLabel(p)` → "Aguardando impressão" / "Aguardando data" / "Sim".
- Comportamento: quando `fotolito_impresso` voltar para "Não" ou "Selecione…", limpar `fotolito_executado` automaticamente (já coberto por `setSimNaoComData`).
- Filtro do dashboard Arte "Fotolito Finalizado" passa a usar os novos labels.

### 5. Etapa dinâmica DTF + Silk (pedidos.ts → `calcularEtapaAtual`)
Para `tipo_estampa === "DTF+Silk"`, quando exatamente um dos lados da arte ainda não está pronto e o outro já está pronto:
- DTF pronto e Silk ainda na arte → etapa = **"DTF Pronto / Silk na Arte"**, cor = mesma de "Aguardando Arte" (`blue`).
- Silk pronto e DTF ainda na arte → etapa = **"Silk Pronto / DTF na Arte"**, cor = `blue`.
- Quando os dois lados da arte estão prontos, segue o fluxo normal (Aguardando DTF / Silk / DTF+Silk / Acabamento).
- Esses dois novos rótulos passam pela paleta de cor existente (`etapaPaletteClass`) — adicionar mapeamento para a cor azul "Aguardando Arte".

### 6. Filtro de Etapa completo no Dashboard Master (DashboardTab.tsx)
Atualizar o `<Select>` "Etapa" para listar todas as etapas existentes:
- Todas (menos finalizados)
- **Pendências de Arte** (novo — engloba `Aguardando Arte` + `DTF Pronto / Silk na Arte` + `Silk Pronto / DTF na Arte`)
- Aguardando entrada
- Aguardando input de produção
- Aguardando Arte
- DTF Pronto / Silk na Arte
- Silk Pronto / DTF na Arte
- Aguardando DTF
- Aguardando Silk
- Aguardando DTF + Silk
- Aguardando Acabamento
- Aguardando Expedição
- Finalizados

A função `pedidoEmEtapa` será reescrita para comparar com `calcularEtapaAtual(p).etapa` (assim os filtros refletem exatamente a etapa real do pedido). O filtro "Pendências de Arte" inclui os três rótulos acima.

### Detalhes técnicos
- **Arquivos editados:** `src/lib/pedidos.ts`, `src/components/pcp/ArteTab.tsx`, `src/components/pcp/DashboardTab.tsx`, `src/components/pcp/shared.tsx` (paleta da nova etapa), `src/components/pcp/DTFTab.tsx`, `src/components/pcp/SilkTab.tsx`, `src/components/pcp/AcabamentoTab.tsx`, `src/components/pcp/ExpedicaoTab.tsx`, `src/components/pcp/DadosInTab.tsx`, `src/components/pcp/FinalizadosTab.tsx`.
- **Sem migration de banco** — `fotolito_executado` continua sendo `text` e passa a armazenar a data em ISO.
- **Sem mudanças em colunas, ordens ou tamanhos de fonte** nas tabelas existentes.
- **Validação de "Sim sem data"** usa `toast` (sonner) já presente no projeto.

Aguardando aprovação para implementar.
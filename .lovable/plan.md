## Plano — Ajustes na tabela MAP Programação de Fios

Escopo 100% frontend. Sem migrations, sem tocar em `cop-saldos.ts`, PCP, COP nem nos blocos Malharia/Tinturaria/InlineInput/BaixaQuebra/MapConfigPanel.

### Arquivos alterados

**1. `src/lib/map.ts`**
- Adicionar helper `prodCode(numero: number): string` → `` `PROD${numero}` ``.
- Em `useMapData`: trocar ordenação da query `map_producoes` para `data_pedido` ASC + `numero` ASC (ambas as abas).

**2. `src/components/map/NovoProdDialog.tsx`**
- Aceitar prop opcional `producao?: MapProducao`.
- Se `producao` presente: pré-preencher campos (`numero`, `data_pedido`, `faturar_para`, `fornecedor`, `kg_solicitados`, `malharia`), título "Editar PROD{n}", botão "Salvar alterações", `patchProducao` no submit.
- Se ausente: comportamento atual (INSERT), inalterado.
- Aviso de número duplicado (`window.confirm`) ignora o próprio Prod em edição.
- Trocar label "Faturar para" → "Empresa" (valores Juff/Joke mantidos).
- Mensagem de duplicado usa `prodCode(n)`.

**3. `src/components/map/ProgramacaoFiosTab.tsx`** (MapFiosTable) — mudanças principais:
- **Barra superior:** trocar lados no flex — botões "Novo pedido" + "Expandir tudo" + "Recolher tudo" à esquerda; contadores à direita.
- **State novo:** `editingProd: MapProducao | null` para reaproveitar `NovoProdDialog` em modo edição.
- **Barra de filtros** (nova, acima dos grupos), padrão visual dos `Select` do COP:
  - Data de pedido (`DateInputBR` + botão limpar)
  - Empresa (Todos / Juff / Joke)
  - Fornecedor (Todos + distintos dos Prods carregados)
  - Nota fiscal (input texto, "contém" case-insensitive)
  - Status (Todos / Aguardando faturamento / Entregue) — só quando `!finalizado`
  - Aplicados client-side (AND); grupos vazios somem; contadores refletem filtrados.
- **Ordenação:** `grupos` em ordem ASC de data; dentro do grupo, `numero` ASC.
- **Nova ordem de colunas** (após chevron):
  1. Prod (`prodCode(numero)`, tabular-nums, esquerda)
  2. Empresa (esquerda)
  3. Kg solicitados (tabular-nums, esquerda)
  4. Fornecedor (esquerda)
  5. Data pagamento (InlineInput date, largura fixa)
  6. Status (badge)
  7. Nota fiscal (InlineInput; regra atual de setar status=entregue preservada)
  8. Data de faturamento (InlineInput date, largura fixa)
  9. Ações — direita: Finalizar (quando aplicável), **Editar**, Excluir; ou Reabrir na aba Finalizados.
- **Editar:** botão abre `NovoProdDialog` com `producao={prod}`.
- **Alinhamento uniforme:** padronizar padding `p-1.5` em `<th>` e `<td>`; alinhamentos conforme spec.
- **Cabeçalho do grupo:** `text-[25px] font-semibold` com padding vertical maior (ex.: `py-2`), fundo amarelo mantido.
- **Textos com `prodCode`:** toasts finalizar/reabrir, confirmação de excluir, coluna Prod.
- Ajustar `colSpan` da linha expandida (agora 9 colunas de dados).

### Fora de escopo (não tocar)
`MalhariaBlock.tsx`, `TinturariaBlock.tsx`, `InlineInput.tsx`, `BaixaQuebraDialog.tsx`, `MapConfigPanel.tsx`, `cop-saldos.ts`, PCP, COP, banco de dados.

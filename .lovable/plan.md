## 1. Aviso de "alterações não salvas" ao trocar de aba

Criar um contexto global de "dirty form" em `src/routes/_authenticated/index.tsx`:

- Novo `DirtyFormContext` exporta `{ isDirty, setDirty, registerSave }`.
- Cada aba de edição (DadosIn, Arte, DTF, Silk, Acabamento) chama `setDirty(true)` no `onChange` dos campos e `setDirty(false)` após salvar / selecionar outro pedido / cancelar. Cada aba também registra sua função `handleSave` via `registerSave` enquanto está montada.
- No `Tabs onValueChange` interceptamos a troca: se `isDirty`, abrimos um `AlertDialog` (shadcn) com a mensagem **"Tem certeza que deseja sair? As alterações não foram salvas."** e dois botões:
  - **Salvar** — verde (`bg-success text-success-foreground`): chama `registerSave()`, aguarda, limpa dirty e troca a aba.
  - **Não Salvar** — vermelho (`bg-destructive text-destructive-foreground`): limpa dirty e troca a aba.
  - (mantém um "Cancelar" implícito ao fechar o dialog, sem trocar de aba.)
- Mesma proteção aplicada ao botão "Sair" do header e ao link "Configurações".

## 2. Padronizar últimas duas colunas dos dashboards

Em **todos** os dashboards (`DashboardTab`, `DadosInTab`, `ArteTab`, `DTFTab`, `SilkTab`, `AcabamentoTab`) as duas últimas colunas da tabela devem ser, nesta ordem: **Saída Juff** (`data_saida_juff`) e **Data Entrega** (`data_entrega`). Coluna "Ações" passa a vir antes dessas duas (ou movemos as ações para o início conforme o padrão atual — manteremos Ações imediatamente antes para não perder o acesso). Resultado final por linha:

```
... colunas da aba ... | Ações | Saída Juff | Data Entrega
```

Aplicar formatação com `formatDateBR` e `whitespace-nowrap`. Atualizar também os `colSpan` dos estados de "Carregando" / "Nenhum pedido".

No `DashboardTab` o sort por "Data Entrega" continua disponível (ícone no header da nova posição).

## 3. Visibilidade: todos os pedidos abertos em todas as abas

Ajustar `src/lib/pedidos.ts` e as listagens das abas:

- `visivelEmArte`, `visivelEmAcabamento`, e os filtros internos do `DashboardTab` passam a retornar `true` para **qualquer pedido não finalizado** (`!p.finalizado_em`). O gating por `dadosInCompletos` / `arteCompleta` deixa de esconder.
- `visivelEmDTF` continua condicionado a `tipoIncluiDTF(tipo) || tipo === "Lisa"` apenas quando o tipo já estiver definido; se `tipo_estampa` ainda estiver vazio, o pedido também aparece (área precisa enxergar o que está por vir).
- `visivelEmSilk` análogo: aparece se `tipoIncluiSilk(tipo) || tipo === "Lisa"` ou se `tipo_estampa` vazio.
- Em cada aba (`ArteTab`, `DTFTab`, `SilkTab`, `AcabamentoTab`, `DadosInTab`) o dashboard interno (lista de pedidos para seleção) usa essas novas funções, então listará todos os pedidos em aberto, marcando com a `Etapa` atual para a área saber o que já passou e o que está por vir.
- A lógica de **cascata** (banners "Aguardando…", bloqueios de edição de campos, mensagem "Pedido Lisa — sem estampa") **permanece** dentro do editor de cada aba — só a visibilidade dos pedidos no dashboard da aba muda.
- `Finalizados` continua exclusivo para `p.finalizado_em != null`.

## Arquivos afetados

- `src/routes/_authenticated/index.tsx` — contexto dirty + AlertDialog + interceptação do `Tabs`.
- `src/components/pcp/DadosInTab.tsx`, `ArteTab.tsx`, `DTFTab.tsx`, `SilkTab.tsx`, `AcabamentoTab.tsx` — registrar dirty/save, reordenar colunas, usar novas funções de visibilidade.
- `src/components/pcp/DashboardTab.tsx` — reordenar colunas (Saída Juff + Data Entrega como últimas).
- `src/lib/pedidos.ts` — afrouxar `visivelEm*` para mostrar todos os pedidos em aberto.

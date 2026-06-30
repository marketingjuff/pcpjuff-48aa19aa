# Plano — Secagem obrigatória + Limpar Filtros

Mudanças 100% front-end, sem banco de dados.

## 1. Dias de Secagem obrigatório quando há Silk

Arquivo: `src/components/pcp/DadosInTab.tsx`

- Em `saveProducao()`, após calcular `missP` com base em `PROD_REQUIRED`, acrescentar regra condicional:
  - Se `tipoIncluiSilk(form.tipo_estampa)` for `true` e `form.dias_secagem` estiver vazio/nulo (string vazia antes da conversão ou `null`), adicionar `"dias_secagem"` ao `missP`.
  - Valor `0` continua válido.
  - `soDTF` e `"Lisa"` não disparam a regra.
- Atualizar `setMissingProd(missP)` e o `toast.error` de campos obrigatórios para incluir essa chave naturalmente.
- No `<Field>` "Dias de Secagem (dias corridos)" (linha ~612):
  - Adicionar `invalid={missingProd.has("dias_secagem")}`.
  - Mostrar label com asterisco (`"Dias de Secagem (dias corridos) *"`) somente quando `incluiSilk` for `true`. Quando `soDTF` mostrar o texto "Não se aplica" já existente, sem asterisco.

## 2. Botão "Limpar Filtros" nas 8 abas do PCP

Para cada arquivo abaixo:
- Criar função local `limparFiltros()` que chama os setters já existentes com os valores iniciais.
- Adicionar um `<Button variant="outline" size="sm">` com ícone (vassoura `Broom` indisponível no lucide → usar `Eraser` ou `FilterX`) e texto fixo "Limpar Filtros", posicionado à direita da área de filtros da aba.
- Não tocar em paginação, seleção, diálogos ou ordenação.

| Aba | Arquivo | Resets |
|---|---|---|
| Dashboard | `DashboardTab.tsx` | `vendedor="todos"`, `status="todos"`, `tipo="todos"`, `etapa="ativas"`, `dataEntrega=""`, `search=""` |
| Dados In | `DadosInTab.tsx` | `etapaFiltro="ativas"`, `search=""`, `vendedor="todos"`, `status="todos"`, `tipo="todos"`, `dataEntrega=""` |
| Arte | `ArteTab.tsx` | `fEtapa="arte"`, `fSearch=""`, `fTipo="todos"`, `fDtf="todos"`, `fFoto="todos"`, `fStatusArte="todos"`, `fWarning=false` |
| DTF | `DTFTab.tsx` | `fOrc=""`, `fPed=""`, `fStatus="todos"`, `fImpresso="todos"`, `fEstampado="todos"`, `fEtapa="dtf"` |
| Silk | `SilkTab.tsx` | `fOrc=""`, `fPed=""`, `fStatus="todos"`, `fTela="todos"`, `fSilk="todos"`, `fEtapa="silk"` |
| Acabamento | `AcabamentoTab.tsx` | `fOrc=""`, `fPed=""`, `fDtf="todos"`, `fSilk="todos"`, `fEtapa="acabamento"` |
| Expedição | `ExpedicaoTab.tsx` | `fPed=""`, `fOrc=""`, `fUF=""`, `fForma="todos"`, `fEtapa="expedicao"` |
| Finalizados | `FinalizadosTab.tsx` | `search=""`, `periodo="tudo"`, `de=""`, `ate=""` |

Regras: sem componente compartilhado novo, sem refatorar filtros, texto fixo "Limpar Filtros", COP e Retrabalho fora desta etapa.

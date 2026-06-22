## Objetivo

Remover a opção **"Pendências de Arte"** de todos os filtros de Etapa e fazer com que **"Aguardando Arte"** passe a incluir tudo que era pendência de arte (Aguardando Arte + DTF Liberado / Silk na Arte + Silk Liberado / DTF na Arte).

## Mudanças

### `src/components/pcp/shared.tsx`
- Em `ETAPA_FILTRO_OPCOES`, remover a entrada `{ value: "pendencias_arte", label: "Pendências de Arte" }`. Isso já faz a opção sumir do Dashboard Master e dos filtros derivados.
- Em `_ETAPA_MAP`, ampliar `arte` para `["Aguardando Arte", "DTF Liberado / Silk na Arte", "Silk Liberado / DTF na Arte"]`.
- Remover o `Set` `_ETAPA_PENDENCIAS_ARTE` e o ramo `if (value === "pendencias_arte") ...` em `matchEtapaFiltro` (não há mais opção que o use).
- Os filtros `ETAPA_FILTRO_OPCOES_DADOS_IN` e `ETAPA_FILTRO_OPCOES_ACABAMENTO` continuam derivados de `ETAPA_FILTRO_OPCOES` — o `.filter(o => o.value !== "pendencias_arte")` vira no-op mas fica para legibilidade (sem mudança de comportamento).

### `src/components/pcp/DashboardTab.tsx`
O dashboard tem sua própria implementação `pedidoEmEtapa`:
- Remover `"pendencias_arte"` do tipo `Etapa`.
- Remover o `Set` `ETAPA_PENDENCIAS_ARTE` e o ramo `if (e === "pendencias_arte") ...`.
- Atualizar o map: `arte: ["Aguardando Arte", "DTF Liberado / Silk na Arte", "Silk Liberado / DTF na Arte"]`.
- Remover o `<SelectItem value="pendencias_arte">Pendências de Arte</SelectItem>`.

## Não muda

Nenhum outro filtro, coluna, StatCard, banner ou cor é alterado. O comportamento das opções "Aguardando DTF" e "Aguardando Silk" (que já incluem os estágios intermediários) permanece como está.
## Ajustes no esquema de refação — PCP Juff

Plano para os 5 itens. Implementação ocorrerá um item por vez após aprovação.

---

### 1. Bug do destino do Refazer

Hoje `calcularEtapaAtual()` (em `src/lib/pedidos.ts`) calcula a etapa a partir dos checks (`pedido_olist`, `arte_data`, `dtf_estampado`, `silk_feito`, `embalado`). Como o Refazer não limpa esses campos, o pedido continua sendo classificado na etapa anterior — ignorando o `etapa_destino` do episódio aberto.

**Correção (sobreposição do destino quando há episódio aberto):** logo no início de `calcularEtapaAtual`, antes do cálculo normal, verificar `episodioAberto(p)`. Se houver, retornar a etapa correspondente ao `etapa_destino` do episódio:

```text
dados        → "Aguardando Dados In"
arte         → "Aguardando Arte"
dtf          → "Aguardando DTF"
silk         → "Aguardando Silk"
acabamento   → "Aguardando Acabamento"
```

Asteriscos continuam sendo aplicados ao fim (1 por episódio existente). O fechamento automático (`fecharEpisodiosResolvidos`) precisa comparar contra a etapa **natural** (sem destino forçado) — então acrescentaremos um parâmetro/flag interno para esse cálculo cru, evitando loop. Resultado: o pedido aparece **só** na aba do destino enquanto o episódio estiver aberto; ao operador concluir essa etapa, o episódio fecha e o fluxo segue normal.

---

### 2. Campo "Peças extras pedidas" no Dados In

- Adicionar campo `pecas_extras?: number` em `RefacaoEpisodio`.
- No `RefacaoDialog`, quando `destino === "dados"`, exibir campo "Quantas peças extras pedidas?" (numérico, opcional, ≥ 0). Para outros destinos, não mostrar e não gravar.
- O número fica preso no episódio (vai junto no item 5 — retrato).
- `qtd` original do pedido **não muda**.

**Helper novo** em `pedidos.ts`:
```ts
export function totalProducao(p: Pedido): { total: number; original: number; extras: number };
```
soma `qtd` + Σ `pecas_extras` dos episódios.

**Exibição em todos os cards/linhas (Arte, DTF, Silk, Acabamento, Expedição, Dashboard):** onde hoje renderiza `p.qtd`, trocar por um pequeno componente `QtdTotal` em `shared.tsx`:
- sem extras → `500`
- com extras → `550 (500 +50)`

---

### 3. Formatação dos dados na aba Retrabalho

Em `RetrabalhoTab.tsx`, trocar inputs crus por exibição formatada (somente leitura para campos derivados; gestor continua podendo editar via botão "Editar episódio" → modal, ou mantemos campos editáveis com máscara — proposta: **read-only por padrão + botão Editar** que abre os mesmos inputs de hoje, evitando edição acidental de UUID/ISO).

Formatadores:

| Campo | De | Para |
|---|---|---|
| Data | `2026-06-22T18:43:36.027Z` | `22/06/2026 15:43` (fuso BR) |
| Responsável | UUID | nome do `profiles.nome` (cache: hook `useProfilesMap()` carregando uma vez) |
| Etapa origem/destino | `dados`, `arte`, `dtf`, `silk`, `acabamento`, ou rótulos como `Aguardando DTF` | `Dados In`, `Arte`, `DTF`, `Silk`, `Acabamento`, `Expedição` |
| Peças perdidas | `0` ou `50` | `Não` ou `Sim — 50` |
| Adesivos perdidos | `0` ou `100` | `Não` ou `Sim — 100` (omitir se pedido não tem DTF) |
| Peças extras | `50` | `+50` |
| Aberto | `Sim/Não` | `Em aberto` / `Encerrado` (badge) |

Layout do card do episódio segue o exemplo enviado (grid 2 colunas + retrato no fim + botões Apagar / Salvar).

---

### 4. Registro automático nas observações

Quando um episódio é criado em `montarRefacoesAposRefazer` (`refacao-helpers.ts`):

1. Buscar nome do responsável atual (`profiles.nome` pelo `auth.uid()`).
2. Montar string formatada e prefixar (linha em cima) ao `observacoes_pedido` do pedido — o campo geral que já é exibido em todas as abas via `ObservacoesOutrosSetores` (mapeado a `producao`). Operador não digita nada.

Formato exato:
```
22/06/2026 15:43 — Refação (automático)
Voltou de Acabamento para Dados In · 50 peças a refazer · 50 peças perdidas · 100 adesivos perdidos · +50 extras · responsável: Jefferson · motivo: estampado na cor errada
```

Regras de omissão:
- Sem adesivo quando `!tipoIncluiDTF(p.tipo_estampa)` ou `perda_adesivos === 0`.
- Sem "+N extras" se `destino !== "dados"` ou `pecas_extras` não informado.
- Sem "50 peças perdidas" se `perda_pecas === 0`.

`montarRefacoesAposRefazer` passará a retornar `{ refacoes, observacoes_pedido }`; quem chama (DTF/Silk/Acabamento/Expedição tabs) salva os dois campos juntos.

---

### 5. Retrato congelado por episódio

Adicionar em `RefacaoEpisodio`:

```ts
retrato?: {
  entrada_pedido: string | null;       // ISO da entrada
  saida_juff: string | null;           // data Saída Juff (planejada)
  etapas_concluidas: Array<{
    etapa: "Arte" | "DTF" | "Silk" | "Acabamento";
    data: string | null;               // ISO (campo já existente ou agora)
    responsavel: string | null;        // nome (não UUID)
  }>;
};
```

**Captura no momento da criação do episódio** (em `montarRefacoesAposRefazer`):
- `entrada_pedido` ← `p.entrada_pedido`
- `saida_juff` ← `p.saida_juff`
- Para cada etapa concluída até o momento, montar entrada baseada em:
  - Arte → `arte_data` + responsável (carregar do `status_arte` finalizado / fallback "—")
  - DTF → `dtf_data_executada` + `quem_bateu_dtf`
  - Silk → `silk_data_executada` + `quem_bateu_silk`
  - Acabamento → `acabamento_data` + `responsavel_acabamento`

Só inclui etapas que de fato foram concluídas até o momento da refação (`dtfCompleto`, `silkCompleto`, etc.).

**Exibição** no card do episódio na aba Retrabalho, no padrão do exemplo enviado (linha "Datas originais" + linha "Etapas concluídas" com ✓).

---

### Arquivos afetados

- `src/lib/pedidos.ts` — sobreposição de etapa, helper `totalProducao`, tipo `RefacaoEpisodio` (pecas_extras + retrato).
- `src/components/pcp/RefacaoDialog.tsx` — campo "Peças extras" quando destino = dados.
- `src/components/pcp/VoltarDropdown.tsx` — passar destino ao Dialog para condicional do extras.
- `src/components/pcp/refacao-helpers.ts` — capturar retrato, gravar `pecas_extras`, montar observação automática, retornar `{ refacoes, observacoes_pedido }`.
- `src/components/pcp/{DTF,Silk,Acabamento,Expedicao}Tab.tsx` — salvar `observacoes_pedido` retornado.
- `src/components/pcp/RetrabalhoTab.tsx` — reescrita do card do episódio (read-only + Editar) com formatação + retrato.
- `src/components/pcp/shared.tsx` — novo `QtdTotal` exibido em cards/linhas.
- `src/hooks/use-profiles-map.ts` (novo) — mapa `uuid → nome` para Responsável.
- Atualizar todas as tabs onde `p.qtd` aparece em cards/linhas para usar `QtdTotal`.

Sem migrações de banco: tudo cabe no jsonb `refacoes` existente.

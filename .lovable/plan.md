## Correção: refação trava o pedido no destino

### 1. Tirar a sobreposição "destino manda" do cálculo de etapa
**`src/lib/pedidos.ts` — `calcularEtapaInterno`**

- Remover o bloco que força `etapa/cor` para `DESTINO_TO_ETAPA[aberto.etapa_destino]` quando há episódio aberto. Também remover o map `DESTINO_TO_ETAPA` (não usado em mais nenhum lugar).
- O cálculo passa a ser sempre o natural; o asterisco no final continua sinalizando "tem refação aberta".
- `calcularEtapaNatural` e `fecharEpisodiosResolvidos` ficam como estão — o fechamento já compara contra a etapa natural e vai funcionar porque o pedido agora percorre o caminho de verdade.

### 2. Novo helper central: "apagar a partir do destino"
**`src/components/pcp/refacao-helpers.ts`** — adicionar `camposAlimpar(pedido, destino)` que devolve um `Partial<PedidoInsert>` com os campos zerados (status/data/responsável de execução), preservando datas de planejamento (`arte_data`, `inicio_estamparia`, `termino_estamparia`, `saida_juff`) e os dados do Olist.

Mapeamento (somente campos de execução/conclusão, deixando os agendamentos):

- **Arte** (`arte`): `status_arte`, `arte_observacao`, `vetorizacao_executada`, `vetorizacao_dtf`, `vetorizacao_silk`, `dtf_impresso`, `dtf_executado`, `dtf_cortado`, `dtf_cortado_data`, `fotolito_impresso`, `fotolito_executado` — e tudo de DTF + Silk + Acabamento abaixo.
- **DTF** (`dtf`): `dtf_estampado`, `dtf_data_executada`, `quem_bateu_dtf`, `quem_cortou_dtf`, `n_batidas_dtf`, `dtf_pessoas_qtd`, `dtf_observacao` — e Acabamento.
- **Silk** (`silk`): `tela_gravada`, `silk_feito`, `silk_data_executada`, `quem_bateu_silk`, `quem_revelou_tela`, `n_batidas_silk`, `silk_observacao` — e Acabamento.
- **Acabamento** (`acabamento`): `embalado`, `acabamento_data`, `data_saida_juff`, `responsavel_acabamento`, `responsavel_conferencia`, `inicio_acabamento`, `termino_acabamento`, `dias_secagem`, `finalizado_em`, `tempo_producao`, `expedicao_entrou_em` + todos `exp_*`.
- **Dados In** (`dados`): **não apaga nada no momento do Refazer** (só registra o episódio). O wipe acontece depois quando o Dados In for salvo (item 4).

**Lado pedido em DTF+Silk:** quando `destino === "dtf"`, **não** mexer em nenhum campo de Silk; quando `destino === "silk"`, **não** mexer em nenhum campo de DTF. Acabamento sempre é limpo junto.

### 3. Aplicar o wipe nos handlers de Refazer
Substituir as listas hardcoded de campos em cada `handleVoltar/onVoltar` por `...camposAlimpar(selected, destino)`:

- `src/components/pcp/DTFTab.tsx` (handleVoltar)
- `src/components/pcp/SilkTab.tsx` (handleVoltar)
- `src/components/pcp/AcabamentoTab.tsx` (handle)
- `src/components/pcp/ExpedicaoTab.tsx` (onVoltar inline)

O `montarRefacoesAposRefazer` já captura o `retrato` **antes** do wipe (ele só lê do `pedido` recebido), então a ordem está garantida.

### 4. Regra especial Dados In
**`src/components/pcp/DadosInTab.tsx` — handleSave**

Antes de enviar o `onSave`, verificar `episodioAberto(selected)`. Se aberto e `etapa_destino === "dados"`, adicionar ao payload `...camposAlimpar(selected, "arte")` (que cobre Arte + DTF + Silk + Acabamento). Isso libera o pedido para "Aguardando Arte" no próximo cálculo. O cadastro (Olist, nome, datas, etc.) continua sendo salvo normalmente.

O fechamento do episódio acontece automaticamente quando a etapa natural voltar a ser a etapa de origem — sem código novo.

### 5. Corrigir responsável da Arte no retrato
**`refacao-helpers.ts` — `montarRetrato`**: a etapa "Arte" hoje grava `responsavel: null`. Trocar por `p.criado_por_arte ?? p.responsavel_arte ?? null` — verificar qual coluna existe no schema (provavelmente nenhuma das duas; nesse caso usar o último editor dos campos de arte, ou deixar consistente com como as outras etapas resolvem o nome). Resolver na implementação inspecionando o schema; se não houver campo de responsável de Arte, manter `null` mas documentar.

### Fora de escopo
- Não mexer em UI/labels.
- Não mexer no `RetrabalhoTab` nem em `RefacaoDialog`.
- Não criar novo tipo de migration — `refacoes` jsonb continua igual.

### Arquivos editados
`src/lib/pedidos.ts`, `src/components/pcp/refacao-helpers.ts`, `src/components/pcp/DTFTab.tsx`, `src/components/pcp/SilkTab.tsx`, `src/components/pcp/AcabamentoTab.tsx`, `src/components/pcp/ExpedicaoTab.tsx`, `src/components/pcp/DadosInTab.tsx`.

## Objetivo

Substituir o campo numérico "Quantas peças perdidas?" por um **quadro de seleção de peças perdidas** (uma linha por peça: Modelo, Cor, Tamanho, Qtd) tanto no diálogo de criação da refação quanto dentro do visualizador laranja "Visualizar dados de refação", mantendo `perda_pecas` (number) como o total e somando ao `totalProducao`.

## O que muda

### 1. `src/lib/pedidos.ts` — tipos e listas
- Novo tipo `PecaPerdida = { modelo: string; cor: string; tamanho: string; qtd: number }`.
- Novas constantes exportadas: `REFACAO_MODELOS` (14 itens), `REFACAO_TAMANHOS` (`PP…EXXG`) e `REFACAO_CORES` (lista nome+hex do prompt).
- Acrescentar campo opcional `pecas_perdidas?: PecaPerdida[]` em `RefacaoEpisodio` (não quebra registros antigos).
- `perda_pecas` (number) permanece como total e continua sendo somado em `totalProducao`.

### 2. Componente reutilizável `PecasPerdidasEditor`
Novo arquivo `src/components/pcp/PecasPerdidasEditor.tsx`. Quadro com:
- **Linhas de peça** — Modelo (Select), Cor (Select com swatch — fundo = hex da cor, fonte branca; para cores claras como `branco`, `amarelo`, `amarelo flúor`, `verde água`, `menta` etc. usa `#353439`. A decisão de "clara" é feita por luminância relativa do hex, com um limiar fixo), Tamanho (Select) e Qtd (Input numérico, mín 1).
- Botão **`+ Adicionar peça`** sempre visível adiciona uma linha em branco.
- Cada linha tem botão **`OK`** (colapsa a linha para um resumo compacto: swatch + `Modelo · Tamanho · Qtd`) e **`×`** para remover. Resumo é clicável para reabrir/editar a linha. Os botões `OK` e `+` ficam sempre visíveis.
- Rodapé com **"Total de peças perdidas: N"** (soma das qtds das linhas completas).
- Função utilitária `linhaCompleta(p)` para validar: modelo+cor+tamanho preenchidos e `qtd ≥ 1`.
- Prop `readOnly` que esconde controles de edição e mostra só os chips/resumos.

### 3. `src/components/pcp/RefacaoDialog.tsx`
- Acrescentar `pecas_perdidas: PecaPerdida[]` ao `RefacaoFormPayload`.
- Substituir o input numérico atual de "Quantas peças perdidas?" pelo `PecasPerdidasEditor` (renderiza só quando `houvePerdaPecas === "sim"`).
- Validação no `Confirmar refação`: se perda = Sim, exigir pelo menos 1 linha completa; a soma das qtds vira `perda_pecas`. Linhas incompletas são descartadas no envio; se sobrar zero, mostrar erro (mantém UX simples).
- Continuar enviando `perda_pecas` (number) + agora `pecas_perdidas` (array).

### 4. `src/components/pcp/refacao-helpers.ts`
- Em `montarRefacoesAposRefazer`, ao montar o `novo` episódio, gravar também `pecas_perdidas: payload.pecas_perdidas`. `perda_pecas` continua vindo como soma das qtds direto do payload (sem nova lógica de total).

### 5. `src/components/pcp/RefacaoViewerButton.tsx` (visualizador laranja)
- Em `EpisodioRead`, abaixo do bloco "Peças perdidas", renderizar a lista das peças perdidas:
  - **Read-only** para a maioria: chips com swatch da cor + `Modelo · Tamanho · Qtd`.
  - **Editável** (mesmo quadro do passo 2, com `+`, `OK`, `×`) para usuários autorizados (ver controle de acesso abaixo). Edição permitida mesmo em episódio encerrado.
- Botão **"Salvar peças perdidas"** aparece apenas no modo editável. Ao salvar:
  - Recalcula `perda_pecas` do episódio editado = soma das qtds.
  - Atualiza o array `refacoes` inteiro no Supabase: `update pedidos set refacoes = … where id = …`.
  - `queryClient.invalidateQueries(["pedidos"])` para refletir na tela.
  - Toast de sucesso/erro com `sonner`.

### 6. Controle de acesso à edição no visualizador
Pode editar quem for:
- `admin`, ou
- `gestor`, ou
- tem `dados_in_producao` em `areas_extras` (qualquer role).

Implementação: usar `useMyRoles()` direto dentro do `EpisodioRead` (ou um helper local `useCanEditPecasPerdidas()`), checando `role === "admin"`, `role === "gestor"` ou `areas_extras?.includes("dados_in_producao")`.

## O que NÃO muda
- Demais campos do diálogo de refação ("Quantas peças serão refeitas?", perda de adesivos, motivo) continuam iguais.
- Cálculo de `totalProducao` continua usando `perda_pecas` (number) — só passa a refletir a soma das qtds das peças perdidas detalhadas.
- Episódios antigos sem `pecas_perdidas` continuam funcionando (read-only mostra "—" quando vazio; editor abre vazio e permite preencher).
- Sem migração no Supabase — tudo dentro do JSONB `refacoes` existente.

## Detalhes técnicos

```text
RefacaoDialog
└─ PecasPerdidasEditor (value, onChange, readOnly?)
       ├─ linhas: PecaPerdida[]
       ├─ [+ Adicionar peça]
       └─ Total: Σ qtd
```

- **Luminância para escolha da fonte na swatch**: `L = 0.299*R + 0.587*G + 0.114*B` (0–255); fonte cinza-escuro `#353439` se `L > 186`, senão branco. Aplicado tanto no `SelectTrigger`/`SelectItem` da Cor quanto no chip de resumo.
- **PecaPerdida vazia** ao criar nova linha: `{ modelo: "", cor: "", tamanho: "", qtd: 1 }`.
- **Persistência no viewer**: import dinâmico do supabase client já usado no projeto; payload de update é `{ refacoes: novoArray }`.

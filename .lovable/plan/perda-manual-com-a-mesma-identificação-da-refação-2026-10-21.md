# Perda manual com a mesma identificação da refação

## 1. Banco (migração nova, só aditiva)
Arquivo novo `supabase/migrations/<data>_perdas_manuais_identificacao.sql` com exatamente o SQL do pedido (4 colunas com `add column if not exists`). Sem backfill, sem UPDATE, sem mexer em policy. A coluna `motivo` fica intacta.

## 2. src/components/cop/RegistrarPerdaManualDialog.tsx
- Sai da tela o campo Motivo. `useAppList("motivo_perda")` continua, agora como lista de Problema quando "erro da produção" = Não.
- Bloco "Identificação do problema" no topo (moldura, `bg-muted/20`, título pequeno em caixa alta), com 4 campos obrigatórios:
  1. Qual área identificou o problema? (`refacao_area_identifica`)
  2. Houve erro da produção? (Select Sim/Não)
  3. Qual área errou? (`refacao_area_erro`, só quando Sim)
  4. Qual foi o problema? (sempre visível, lista dependente)
- Função local `kindForArea` (cópia, sem importar do PCP): Arte, DTF, Silk, Acabamento, Comercial/Input de Vendedor; senão `motivo_perda`. Com Não usa `motivo_perda`.
- Trocar área que errou limpa Problema. Escolher Não limpa a área que errou (e o Problema).
- Validação com as 4 mensagens do pedido, em texto vermelho acima dos botões. Vale para registro novo e correção.
- Insert: entram os 4 campos novos e `motivo` deixa de ser enviado. Update: entram os 4 campos, sem `motivo` e sem `registrado_por`.
- A edição carrega os 4 campos (nulo vira vazio). `reset()` limpa os 4 e a mensagem de erro.

## 3. src/lib/perdas-consolidado.ts
- `PerdaManualRow` ganha os 4 campos opcionais e nuláveis.
- Fonte D: o objeto passa a levar `area_identificou`, `erro_producao`, `area_erro` e `problema` (`?? null`). `motivo` continua igual. As outras fontes não mudam.

## 4. src/components/cop/ControlePerdasTab.tsx
- `motivoDe`: Problema tem prioridade sobre Motivo para PCP e Manual. COP não muda.
- `areaErro` (linha 258) e comparador `area` (linha 116): sai a restrição a PCP. A regra fica: área do erro, senão "Produção" se `erro_producao`, senão traço.
- Nenhuma coluna nova ou removida.

## 5. src/components/cop/PerdaDetalheDialog.tsx
- A linha Motivo/Observações só aparece quando `perda.motivo` tem valor.

## Ao final
Typecheck e diff em /mnt/documents/diff-perda-manual-identificacao.diff. Nenhum arquivo fora da lista será tocado.

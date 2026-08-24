# COP — Romaneio em "Aguardando Pagamento" sai da aba Romaneio e de Oficinas Hoje

Somente 2 arquivos tocados. Nenhuma migração, nenhum SQL, nenhuma coluna nova.

## 1. `src/lib/cop-oficinas.ts`

Em `copAtivoEmOficina`, adicionar uma linha: `if (c.status === "Aguardando Pagamento") return false;`
e atualizar o comentário. Nada mais no arquivo muda — `cargaPorOficina`,
`copsPorOficina`, `arvoreProducaoHoje`, subtotais e totais herdam o filtro
automaticamente.

Efeitos desejados: Oficinas Hoje deixa de listar e de somar o romaneio já
conferido; o card de carga por oficina na busca de peças também para de contá-lo;
o bloco "Romaneios ativos com a peça" do popup de falta fica mais limpo (saldo
zero por definição). `FaltaPecaPopup.tsx` não é modificado.

## 2. `src/components/cop/RomaneioTab.tsx`

- **Filtro `__ativos__`**: passa a excluir também `status === "Aguardando Pagamento"`.
  O `else if` do seletor fica intocado, então escolher "Aguardando Pagamento" ou
  "Todos" continua mostrando o COP.
- **Rótulo da opção**: `Ativos, sem Aguardando Pagamento, Pagos e Finalizados`
  (largura do trigger mantida; só aumento para `w-[320px]` se estourar).
- **`handleConferir`**: captura `rotuloRomaneio(selected, cops)` antes do await,
  e após `salvar.mutateAsync` faz `setSelectedId(null)` + `toast.success` avisando
  que o romaneio foi para Pagamentos. Sem imports novos, sem mexer no `onSuccess`
  da mutation, sem alterar `jaCompleto`, `mostrarPainel`, `completoTotal`,
  `completoViaPerda`, `podeParticionar`, `bloqueadoRomaneio` ou `statusPorAgregado`.

## Não tocados

`src/lib/cop.ts` (e `STATUS_POS_CORTE`), `PagamentoOficinasTab.tsx`,
`cop-saldos.ts`, `admin.functions.ts`, `schema-extras.ts`. A reversão
"Aguardando Pagamento" → "Romaneio Completo" pela aba Pagamentos volta a exibir
o COP nas duas abas sem ajuste extra, porque a exclusão é só por status.

## Ao final

Rodo o typecheck e mostro o resultado.

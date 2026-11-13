# Refação: separar "perda" de "falta" de adesivo (só texto e layout)

Arquivo único alterado: `src/components/pcp/RefacaoDialog.tsx`. Nenhuma migração, nenhum outro arquivo, nenhuma mudança de estado, validação, condição ou payload.

## 1. Dentro de cada motivo (`BlocoMotivoCampos`, linhas ~168-184)
- Label `Houve perda de adesivos? *` → `Algum adesivo estragou e foi descartado? *`
- Nova linha logo abaixo do label, antes dos botões Sim/Não (`text-[11px] text-muted-foreground`):
  `Adesivo que foi impresso mas saiu errado, torto ou queimou na prensa`
- Label `Quantos adesivos perdidos? *` → `Quantos adesivos foram descartados? *`
- `mostraPerguntaAdesivo`, botões, handlers e estados ficam iguais.

## 2. Pergunta de falta (bloco `{mostraAdesivos && (...)}`, linhas ~369-392)
- A `div` externa `space-y-2` passa a ser a caixa `rounded-md border bg-muted/20 p-3 space-y-3`.
- No topo da caixa, o título `Adesivos do pedido` (`text-[11px] text-muted-foreground font-medium uppercase`) e embaixo a ajuda `Vale para a refação toda, não para um motivo específico` (`text-[11px] text-muted-foreground`).
- Label `Faltou adesivo? *` → `Foram impressos menos adesivos do que o pedido precisava? *`, com a ajuda `A Arte imprimiu a menos e o pedido volta para a Arte` antes dos botões.
- `Quantos adesivos faltaram? *` e o aviso âmbar ficam iguais, dentro da caixa.
- A caixa fica no mesmo lugar: depois de "Adicionar outro motivo" e antes de "Observações da refação".

## Fora do escopo
As mensagens de erro em `confirmar` (por exemplo "Informe se houve perda de adesivos.") não mudam, como o pedido proíbe.

## Ao final
Rodar o typecheck, salvar o diff em `/mnt/documents/diff-refacao-adesivos.diff` e conferir que só esse arquivo mudou.

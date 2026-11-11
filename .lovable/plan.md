# Unificar o registro de perdas (área que errou + problema)

Objetivo: as 4 telas de perda (Refação do PCP, Perda manual, aba Perdas e Romaneio) passam a pedir a mesma identificação do erro, para o painel "Por área do erro" deixar de mostrar quase tudo como "Não informado". Registros antigos ficam como estão.

## Banco de dados (somente adição)
- Uma migração nova, só com as 4 colunas novas em `cop_perdas`: `area_identificou`, `erro_producao`, `area_erro`, `problema`. Nenhuma policy, nenhum UPDATE/DELETE, nenhum item de lista inserido.
- A migração vai pela ferramenta de migração do projeto (o arquivo novo fica na pasta de migrações que ela gerencia, não em `supabase/migrations/`), e `types.ts` é regenerado automaticamente. Observação: esse é o único desvio do caminho citado na allowlist.

## Arquivo por arquivo
1. `src/lib/app-lists.ts` — `"refacao_area_erro_externa"` no `AppListKind`; `useKindProblemaPorArea` procura em internas e depois externas (fallback `motivo_perda` igual); novo `useOpcoesErro()` (duas listas de área + uma consulta `.in("kind", kinds)`, internas primeiro, por `ordem`, fallback `motivo_perda` para área sem problemas); novo `areaExigeOficina(nome)` sem acento/caixa.
2. `src/lib/config-listas-catalogo.ts` — item "Área de fora da Juff que errou" logo após `refacao_area_erro`; novo `notaUso` de `refacao_area_erro` com o texto do pedido.
3. `src/routes/_authenticated/configuracoes.tsx` — só o `useMemo` (~linha 1210): também lê `refacao_area_erro_externa` e insere os cards "Problemas — {área}" logo após o item externo, `modulos: ["pcp","cop"]`, nota "Escolhida quando quem errou de fora da Juff é {área}."
4. NOVO `src/components/cop/IdentificacaoErroCampos.tsx` — componente controlado com tipo `IdentificacaoErro`, `validarIdentificacaoErro(v, oficinaId)` com as 6 mensagens exatas; mesma caixa visual do bloco atual da perda manual; Sim/Não limpa área e problema; trocar área limpa problema; problema desabilitado "Escolha a área primeiro".
5. `RegistrarPerdaManualDialog.tsx` — usa o componente; rótulo "Oficina *" ou "Oficina (opcional)"; `validar()` usa o validador; grava `area_erro` também no Não; edição carrega `area_erro` também com `erro_producao=false` (antigo sem área abre "Não" vazio); remove imports sem uso.
6. `PerdasTab.tsx` (só form "Registrar perda" e `salvar`) — tira o Textarea Motivo; componente acima da grade; erro vermelho dentro do Card acima do botão; insert com os 4 campos novos + `motivo = problema`; limpa o bloco após salvar.
7. `src/lib/cop.ts` — opcionais `area_erro`, `problema`, `erro_producao` em `CopPerdaLinha` e `LancamentoPerda`; `lancamentosPerda` copia no evento `perda` (`?? null`).
8. `RegistrarPerdaDialog.tsx` (romaneio) — `Entrada` com `area_erro`/`erro_producao`; select agrupado "Dentro da Juff · {área}" / "Fora da Juff · {área}" via `useOpcoesErro`, valor `área||problema`, gatilho mostra "{área} · {problema}", largura `w-56`; sem opção "—"; bloqueio "Escolha o problema de todas as perdas lançadas." dentro do diálogo; envia os 3 campos.
9. `RomaneioTab.tsx` — só o `map` dos `itens` do evento `perda` (~linha 293) inclui os 3 campos.
10. `src/lib/perdas-consolidado.ts` — Fontes A e B passam os campos novos; C, reclass, D e fallback intocados.
11. `RefacaoDialog.tsx` — rótulo "O erro foi dentro da Juff? *"; Sim igual; Não ganha "Quem errou de fora da Juff? *" (externas sem "oficina") + "Qual foi o problema? *"; validações novas no Não após as atuais; `onConfirm` manda `area_erro` e `problema` também no Não.
12. `RefacaoViewerButton.tsx` e `RetrabalhoTab.tsx` — só o grid: "Erro dentro da Juff"; área e problema aparecem quando `area_erro` existir.

## Verificação
Typecheck e diff completo em `/mnt/documents/`. Teste pequeno para `areaExigeOficina` e `validarIdentificacaoErro` só se você autorizar (seria um arquivo fora da allowlist). Nenhum teste no preview que grave dados, pois ele usa o banco de produção. Arquivos protegidos e `package.json` intocados.

## Dúvidas para confirmar na aprovação
- Na Perda manual e na aba Perdas, a lista "Quem errou de fora" mostra todas as externas (inclusive Oficina). Só a Refação esconde as de oficina. No Romaneio a oficina já é a do COP, então não peço oficina extra lá.

# Dashboard Master — soma de peças flutuando junto ao mouse

Só `src/components/pcp/DashboardTab.tsx`. Sem migração, sem consulta nova. `totaisSel`/`totaisFiltro` e `totalProducao` não mudam.

## 1. Barra do rodapé
Hoje ela já é simples (sem sticky, sem z-20, sem borda nem fundo próprio). Fica exatamente como está.

## 2. Etiqueta flutuante
- Novo `div` como último filho do `div` raiz `space-y-3`, fora do container da tabela.
- Classes `fixed z-50 pointer-events-none hidden md:block`, `left-0 top-0`, cantos arredondados, fundo escuro sólido via token (`bg-foreground text-background`, que no tema claro dá fundo escuro e texto claro), texto pequeno `tabular-nums`, sombra leve, padding curto.
- Conteúdo com `totaisSel`: "171 peças" em destaque; abaixo, menor, "4 pedidos"; com refação, "(131 + 40 de refação)".

## 3. Posição sem re-render
- `etiquetaRef` (elemento), `etiquetaVisivelRef` (boolean) e `moveuRef` (houve arraste para outra linha).
- `mousemove` registrado no `window` dentro do mesmo `useEffect` do `mouseup`: só enquanto o arraste estiver ativo, atualiza `el.style.transform = translate(x, y)` com +16px à direita/abaixo; inverte para o lado oposto perto da borda direita/inferior (mede `offsetWidth/offsetHeight` do elemento). Nada vai para `useState`.
- `el.style.display` controla mostrar/esconder (display `block`/`none`, prevalecendo sobre a classe só no desktop; no celular a classe `hidden` continua escondendo, pois só aplico `block` quando `window.matchMedia("(min-width: 768px)")` bate).

## 4. Quando aparece e some
- `onMouseDown` na linha: posiciona a etiqueta no cursor e marca `moveuRef = false`.
- `onMouseEnter` com arraste ativo em outra linha: `moveuRef = true`, mostra a etiqueta (o texto se atualiza pelo re-render normal da seleção).
- `mouseup`: se houve arraste, a etiqueta fica parada na última posição; se foi clique simples (sem arrastar), a etiqueta some.
- Some também quando: a seleção é esvaziada ("Limpar seleção", "Limpar Filtros"), `filtrados` muda (filtro, busca, ordenação — já limpa a seleção), e no `onMouseLeave` da tabela quando não houver linha selecionada.

Ambiguidade resolvida: o pedido diz que a etiqueta aparece com uma única linha selecionada, mas também que some num clique simples. Fica assim: clique simples esconde; se você arrastar e voltar para a linha inicial (seleção de uma linha por arraste), a etiqueta continua mostrando os números daquele pedido.

## Ao final
`bunx tsgo --noEmit -p tsconfig.json` e o diff completo do arquivo.

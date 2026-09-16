# Romaneio: oficina e datas somem do card

## O que está acontecendo

No card do romaneio (COP 0068), a oficina aparece como "Selecione..." e as datas em branco, mas o PDF mostra corretamente "Oficina: Cláudia Angélica / Saída: 24/08/2026". Ou seja: os dados estão salvos no banco — o card é que está exibindo vazio.

Causa confirmada na leitura do código (`src/components/cop/RomaneioTab.tsx`): o formulário do card é preenchido uma única vez, no momento em que o romaneio é selecionado. Quando a página é aberta/recarregada já com um romaneio selecionado (a seleção fica guardada), a lista de romaneios ainda não terminou de carregar naquele instante, então o formulário é preenchido com vazio e nunca mais é reabastecido quando os dados chegam. O PDF não passa por esse formulário — ele lê direto os dados carregados — por isso mostra a informação certa.

## Correção

Em `src/components/cop/RomaneioTab.tsx`:

- Preencher o formulário do card também quando os dados do romaneio selecionado chegarem depois (não apenas na troca de seleção), guardando qual romaneio já foi carregado no formulário para não sobrescrever o que a pessoa está digitando.
- Só limpar o formulário quando realmente não há romaneio selecionado, e não quando os dados ainda estão carregando.

Sem mudança de banco, sem mudança de regra de negócio, sem alteração no PDF.

## Como verificar

Recarregar a aba Romaneio com o COP 0068 selecionado: oficina "Cláudia Angélica" e data de saída 24/08/2026 devem aparecer no card, iguais ao PDF.

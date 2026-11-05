# PLAN — mínimo adotado vira piso da sugestão de corte

Nenhuma migração, nenhum SQL e nenhum outro arquivo além dos dois permitidos.

## Pontos conferidos no código (ajustes ao pedido)
1. **`usePlanLinhas` está em `NecessidadeTab.tsx`, e não em `plan.ts`.** A mudança do item 1d será feita lá, dentro da mesma allowlist.
2. **"Byte a byte":** sem `minimosAdotados`, todos os campos atuais saem idênticos. A linha só ganha os dois campos novos, sempre zerados (`porMinimoPorTam` com 0 por tamanho e `porMinimo: 0`). Isso é inevitável, porque a interface ganha esses campos. O teste compara todos os campos antigos.
3. **Negrito:** hoje toda célula de sugestão maior que zero já é `font-semibold`. Para o piso aparecer, a célula elevada pelo piso passa a `font-extrabold`. Nada mais muda: sem ícone, coluna ou largura nova.
4. **Tinturaria:** concordo que o piso reflita lá via escopo "suprimento". Nenhuma mudança no arquivo da Tinturaria.

## `src/lib/plan.ts`
- `LinhaNecessidade` ganha `porMinimoPorTam: Record<string, number>` e `porMinimo: number`.
- `montarNecessidade` ganha o parâmetro opcional `minimosAdotados?: Map<string, MinimoSalvo>`. No laço por tamanho, depois de `prevLiquido`:
  - `minimo` é o mínimo adotado daquela peça, ou 0;
  - `faltaParaMinimo` é `max(0, minimo - estoqueLivre)`;
  - `previsao` é `max(prevLiquido, faltaParaMinimo)`;
  - `aProduzirPorTam[t]` fica `foraDeLinha ? 0 : firme + previsao`;
  - `porMinimoPorTam[t]` fica `foraDeLinha ? 0 : max(0, faltaParaMinimo - prevLiquido)`.
  
  `firmePorTam` não muda. Fora de linha zera também o `porMinimo`, para o selo não aparecer numa linha com sugestão zero.
- `aplicarPausas`: a linha pausada recebe `porMinimoPorTam` zerado e `porMinimo: 0`. Nada mais muda nessa função.

## `src/components/plan/NecessidadeTab.tsx`
- `usePlanLinhas` chama `usePlanMinimos()`. Passa os mínimos para `montarNecessidade` só quando não há erro; com erro, segue a conta antiga, sem tela de erro. Inclui o carregamento dos mínimos no `isLoading` e na dependência do cálculo.
- Na célula Modelo, quando `porMinimo > 0`, aparece um `Badge variant="outline"` pequeno "piso do mínimo", com o `title` pedido.
- Nas células de sugestão, `porMinimoPorTam[t] > 0` deixa o número em extra-negrito.

## Verificação
- Testes das funções puras em /tmp, sem deixar nada no repositório:
  - sem mínimos, os campos antigos ficam iguais aos de hoje;
  - mínimo 100, livre 40, horizonte 20: sugestão 60;
  - mínimo 100, livre 40, horizonte 200: sugestão 200;
  - a parte firme não muda;
  - fora de linha fica em 0;
  - pausada mostra só a parte firme, com piso 0;
  - peça sem mínimo fica como antes.
- Typecheck e diff completo dos dois arquivos.

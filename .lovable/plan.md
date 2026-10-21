# Configurações › Listas — sub-abas por grupo

Único arquivo tocado: `src/routes/_authenticated/configuracoes.tsx`, só dentro de `ListasTab`. Sem migração, sem arquivo novo, sem dependência nova.

## Mudanças em ListasTab
1. **Estado da sub-aba por módulo:** `useState<Record<string, string>>`, carregado na montagem (em `useEffect`, para não dar diferença entre servidor e navegador) a partir de `localStorage` `cfg.listas.grupo.<modulo>`, com leitura dentro de `try/catch`. Ao trocar a sub-aba, atualiza o estado e grava a chave do módulo (`try/catch`).
2. **Grupo válido:** `grupoAtivo(m, grupos)` devolve o valor salvo se ele ainda existir entre os grupos do módulo. Senão, devolve o primeiro grupo.
3. **Aba de módulo controlada:** troca `defaultValue="pcp"` por `value`/`onValueChange` com estado em memória. Assim, ao apagar a busca, as abas voltam no mesmo módulo e na mesma sub-aba (critério 7). A aparência dessa linha não muda.
4. **Dentro de cada `TabsContent` de módulo:**
   - Se houver 1 grupo: mostra direto o `grid gap-6 md:grid-cols-2` com `cardDe`.
   - Se houver 2 ou mais: `Tabs` aninhado controlado, com `TabsList className="mb-4 flex flex-wrap h-auto"` sem `moduloTabClasses`. Cada `TabsTrigger` mostra o nome do grupo e `<span className="ml-1.5 text-xs text-muted-foreground tabular-nums">{n}</span>`, com `n` igual ao `.length` dos itens daquele grupo. Cada `TabsContent` do grupo tem o mesmo grid com `cardDe`.
   - O cabeçalho de texto do grupo é removido, porque não é mais usado.
5. **Sem mudança:** busca, `resultados`, `cardDe`, `ListaCard`, `modulos`, as permissões e as outras seções.

## Ao final
Rodar o typecheck e mostrar o resultado.

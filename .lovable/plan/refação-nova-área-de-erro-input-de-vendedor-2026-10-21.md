# Refação — nova área de erro "Input de Vendedor"

## Passo 1 — verificação (já feita, só leitura)
A tabela de listas não tem nenhuma regra de validação sobre o tipo da lista (a consulta voltou vazia), então dá para seguir para o passo 2.
Áreas cadastradas hoje: Arte (10), DTF (20), Silk (30), Acabamento (40). "Input de Vendedor" entra com ordem 50.

## Passo 2 — novo arquivo em supabase/migrations/
Só os dois INSERT do prompt, sem mudar nenhuma linha, ambos protegidos por WHERE NOT EXISTS:
- `refacao_area_erro`: "Input de Vendedor" (50)
- `refacao_problema_input_vendedor`: "erro de layout" (10), "erro de quantidade" (20)

Não há DROP, DELETE, TRUNCATE nem ALTER.

## Arquivos
1. **src/lib/app-lists.ts**: incluir `| "refacao_problema_input_vendedor"` no tipo `AppListKind`, na linha logo depois dos outros `refacao_problema_*`.
2. **src/components/pcp/RefacaoDialog.tsx**:
   - `kindForArea`: novo `case "Input de Vendedor": return "refacao_problema_input_vendedor";` antes do `default`.
   - O texto da linha 200 passa a ser "Houve erro interno (Arte, DTF, Silk, Acabamento ou Input de Vendedor)? *".
   - Nada mais muda.
3. **src/lib/config-listas-catalogo.ts**: incluir a entrada "Problemas do Input de Vendedor" (com notaUso) logo depois de `refacao_problema_acabamento`, sem mexer nas outras entradas.

Nenhum outro arquivo é tocado, inclusive os protegidos.

## Ao final
Rodar o typecheck e entregar o diff completo em /mnt/documents/.

## Alterações no Dashboard Master

### 1. Card "Expedição" nos KPIs (parte de cima)

Adicionar 7º card de monitoramento logo após "Acabamento":

- Label: **Expedição**
- Contagem: pedidos com `embalado === "Sim"` e sem `finalizado_em` (etapa "Aguardando Expedição")
- Ícone: `Truck` (lucide-react), accent info
- Ajustar grid de `lg:grid-cols-6` → `lg:grid-cols-7`
- Adicionar filtro `etapa = "expedicao"` no `pedidoEmEtapa()` e no Select de etapa

### 2. Cor de fundo da linha (Saída Juff)

Nova helper `corLinhaSaidaJuff(p, feriados)` em `DashboardTab.tsx`:

- Concluído (`embalado === "Sim"`) → sem destaque
- Sem `data_saida_juff` → sem destaque
- Hoje ≥ saída_juff → **vermelho pastel** (`bg-red-50 hover:bg-red-100`)
- Exatamente 1 dia útil até saída_juff → **amarelo pastel** (`bg-yellow-50 hover:bg-yellow-100`)
- Caso contrário → sem destaque

Usa `diasUteisEntre(hoje, saida_juff, feriados)` (feriados já descontados).

### 3. Reordenação e mudanças de colunas

Nova ordem:

1. Etapa
2. Pedido
3. Orçamento
4. Vendedor
5. QTD
6. **Estampa** (renomeado de "Tipo")
7. Status de Peças (sem % nem "Conclusão")
8. Frete
9. UF
10. Entrada do Pedido
11. Data Arte Limite (`arte_data_limite`)
12. Início de Estamparia (`dtf_data_executada` / `silk_data_executada` — usar o mais antigo preenchido; mostrar "—" se nada)
13. Término Estamparia (idem, mais recente)
14. Dias
15. Saída Juff (`data_saida_juff`)
16. Data de Entrega

Remover: coluna **% Conclusão**, **Prazo**,  **Ações**.  
Manter ordenação clicável em Dias, **Saída Juff** e **Data Entrega**.

### 4. Interação por clique

- 1 clique → seleciona a linha (estado local `selectedRowId`), aplicando `ring-2 ring-primary/60` por cima da cor de status.
- Duplo clique → chama `onEdit(p.id)` (abre Dados IN).
- Remover coluna/botões de Ações.
- Cursor pointer, `select-none` para evitar seleção de texto no duplo clique.

### 5. Compactação da tabela

Em `src/components/ui/table.tsx` aplicar variantes apenas dentro do dashboard via classes locais (não alterar globalmente):

- Cabeçalho: `h-9 px-2 text-xs`
- Células: `py-1.5 px-2 text-xs`
- Aplicar via classNames nas `TableHead`/`TableCell` do Dashboard Master (sem afetar outras tabelas).

### 6. Largura da plataforma

No `src/routes/_authenticated/index.tsx` (e/ou shell), trocar `container mx-auto` por wrapper mais largo: `max-w-[1600px] mx-auto px-4`. Aplicar no `<header>` e `<main>`.

### 7. Referência de prazo (statusPrazo)

Em `src/lib/pedidos.ts`, alterar `statusPrazo()` para usar **apenas `data_saida_juff**` (remover fallback `data_entrega`). Isso afeta o card "Atrasados" e outras telas que usam essa função.

### Arquivos editados

- `src/components/pcp/DashboardTab.tsx` — KPIs, colunas, cor de linha, seleção, duplo clique, compacto
- `src/lib/pedidos.ts` — `statusPrazo` referencia só saída_juff
- `src/routes/_authenticated/index.tsx` — largura do container

### Fora do escopo

- Linha dupla (item 5 do MD: "prever opção") — fica para iteração futura, a menos que você queira já.
- Alterações nos outros dashboards (Arte/DTF/Silk/Acabamento/Expedição) — escopo é só o Master.
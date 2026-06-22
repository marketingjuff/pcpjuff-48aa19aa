Reutilizar o bloco de título grande de Orçamento Comercial que hoje só existe na aba DadosIn e aplicá-lo nas abas Arte, DTF, Silk, Acabamento e Expedição.

Alterações propostas:

1. Criar componente reutilizável `OrcamentoTitle` em `src/components/pcp/shared.tsx` que renderize:
   - Label "Orçamento Comercial" em texto pequeno/uppercase muted
   - Valor do orçamento em texto grande/bold (igual ao padrão da DadosInTab)

2. Inserir esse título no topo do card de cada aba quando um pedido estiver selecionado:
   - `src/components/pcp/ArteTab.tsx`
   - `src/components/pcp/DTFTab.tsx`
   - `src/components/pcp/SilkTab.tsx`
   - `src/components/pcp/AcabamentoTab.tsx`
   - `src/components/pcp/ExpedicaoTab.tsx`

3. Ajustar o `CardHeader` de cada aba para não competir com o novo título (remover "Arte — {pedido}" etc. e deixar o título grande como destaque principal, mantendo os badges de status/refação ao lado).

Resultado: o orçamento grande aparece destacado no topo de todas as abas operacionais, facilitando a leitura.
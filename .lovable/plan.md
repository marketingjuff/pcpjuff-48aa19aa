## Alterações

### 1. Dashboard (master) — `src/components/pcp/DashboardTab.tsx`

Na tabela de pedidos:

- Renomear a coluna `ACABAMENTO` para `TÉRM. ACAB.` e fazê-la exibir `p.termino_acabamento` (em vez de `p.acabamento_data`).
- Adicionar uma nova coluna **antes** dela: `INÍC. DE ACAB.`, exibindo `p.inicio_acabamento`.
- Atualizar a ordenação (`sort`):
  - manter a chave `acabamento` apontando para a coluna de término (`termino_acabamento`);
  - adicionar nova chave `inicioAcab` para a nova coluna (ordena por `inicio_acabamento`).
- Ajustar os `colSpan={18}` para `19` nas linhas de "Carregando..." e "Nenhum pedido.", já que passa de 18 para 19 colunas.

### 2. Dados In do Vendedor — `src/components/pcp/DadosInTab.tsx`

Tornar **Frete** e **Tempo de frete (dias úteis)** obrigatórios:

- Adicionar `"frete"` e `"tempo_frete"` ao array `VENDOR_REQUIRED` (linha 134).
- Acrescentar `*` aos rótulos dos dois campos e ligar `invalid={missingVendor.has("frete")}` e `invalid={missingVendor.has("tempo_frete")}` (linhas 343 e 349).

Sem alterações em lógica de cálculo, persistência ou demais campos.

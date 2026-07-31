# FASE 2 — Importação da planilha Olist (PCP)

Objetivo: importar o `.zip` de pedidos da Olist, mostrar uma prévia completa antes de gravar, e registrar o histórico de importações.

## Arquivos

CRIAR
- `src/lib/olist-vendas.ts` — parser e tipos da importação de vendas
- `src/components/pcp/ImportacaoOlistTab.tsx` — tela de importação (admin)

ALTERAR
- `src/routes/_authenticated/index.tsx` — nova aba "Importação Olist", visível só para admin, seguindo o padrão atual (`...(isAdmin ? [...] : [])` + `TabsContent` com `forceMount`/`hidden`)

Nada mais é tocado. `src/lib/estoque-olist.ts` é apenas importado (`parseProduto`, `normalizarCor`, `normalizarTamanho`, `EmpresaOlist`), sem qualquer alteração.

## Parser (`src/lib/olist-vendas.ts`)

- Descompacta o zip com `jszip` (já presente no projeto) e lê **todos** os `.xls` internos com `xlsx` (`XLSX.read` + `sheet_to_json`).
- Aproveita apenas as 14 colunas previstas; descarta endereço, CEP, município, UF, telefone, celular, e-mail, RG/IE e SKU.
- `num()` para números em formato nativo ou brasileiro (`"41,26"`).
- Datas `DD/MM/AAAA` → `AAAA-MM-DD`.
- Desconto do pedido separado em `desconto_valor` / `desconto_percentual` (`"13%"` → percentual), preservando o texto original.
- Vendedor: primeiro nome, sem caixa, cortando o que vem após traço; casa com `VENDEDORES`, senão `"Outros"`; texto original preservado.
- Cabeçalho deduplicado por número de pedido; itens uma linha cada.
- `parseProduto()` resolve produto/cor/tamanho; falha de formato → linha gravada como serviço (`is_servico = true`), fora da contagem de peças e dos rankings.
- Retorno: `arquivosLidos`, `totalLinhas`, `pedidos`, `itens`, `produtosSemMapeamento`, `servicos`, `linhasIgnoradas`.
- Utilitário de leitura "versão vigente": para cada pedido, o registro do lote com `importado_em` mais recente — usado por todas as consultas seguintes.

## Tela (`ImportacaoOlistTab.tsx`)

1. Envio: seletor obrigatório JOKE/JUFF (sem ele o upload fica bloqueado) + campo `.zip`, com aviso de que a empresa vem da seleção porque o arquivo não a identifica.
2. Prévia (nada é gravado): arquivos lidos, linhas/pedidos/itens, quantos casam com `pedidos.pedido_olist`, quantos só existem na Olist, quantos estão em excluídos, produtos sem mapeamento (com lista), serviços (com lista) e linhas ignoradas com motivo.
3. Alerta de troca de empresa: se algum pedido da prévia já existe em `olist_pedidos` com empresa diferente, lista os afetados e exige confirmação explícita.
4. Gravação: cria o lote e insere pedidos e itens em blocos, para não estourar o limite de requisição.
5. Histórico: tabela somente leitura dos lotes (data, empresa, arquivo, totais, quem importou), do mais recente para o mais antigo.

## Notas técnicas

- Sem migração de banco nesta fase; as 4 tabelas da FASE 1 já existem.
- Sem `UPDATE`/`DELETE`: a importação é append-only.
- Acesso restrito a admin na interface; a RLS admin-only continua sendo a garantia real.

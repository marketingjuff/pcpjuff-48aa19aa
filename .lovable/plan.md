## Escopo

Duas mudanças de UI, apenas frontend, sem migrações.

## 1. Botão Duplicar na Tinturaria

Arquivo: `src/components/map/TinturariaBlock.tsx`

- Adicionar botão "Duplicar" (ícone `Copy` do lucide-react) na última coluna de cada linha de programação, imediatamente **antes** do botão de lixeira.
- Ao clicar, cria uma nova linha via insert em `map_tinturaria_programacoes` copiando os campos da linha atual: `producao_id`, `tinturaria`, `data_programacao`, `pecas_programadas`, `cor`, `kg_enviados`. Campos de recebimento (`kg_recebidos`, `pecas_recebidas`, `data_recebimento`, `nota_fiscal_recebimento`) ficam vazios/nulos — só a "programação" é duplicada, já que a ideia é reduzir digitação repetida.
- Após insert, chamar `onChanged()` para revalidar. Toast de sucesso/erro.
- Desabilitar quando `readOnly`.

## 2. Moldura no Prod expandido

Arquivo: `src/components/map/ProgramacaoFiosTab.tsx`

Hoje, quando o Prod é expandido, a linha principal e a linha de detalhes só têm um `hover:bg-yellow-50/50` e `bg-yellow-50/30` respectivamente, o que confunde visualmente entre Prods vizinhos.

Ajuste: quando `isOpen === true`, aplicar um destaque mais forte que englobe as duas linhas (a de resumo + a expandida):

- Linha de resumo aberta: fundo amarelo mais forte (ex.: `bg-yellow-100`) + `border-l-4 border-yellow-400` na primeira célula para marcar início do bloco.
- Linha de detalhes: mesmo `border-l-4 border-yellow-400`, fundo `bg-yellow-50`, e uma `border-b-4 border-yellow-400` (ou similar) para fechar a moldura visualmente.
- Espaçamento inferior extra (ex.: uma linha "spacer" ou `pb-3` no conteúdo expandido) para separar do próximo Prod.

Objetivo: quem olha a tabela vê claramente "este Prod, com todo o seu conteúdo expandido, é um bloco único", diferenciando do próximo Prod da mesma data.

Sem alterações em lógica, dados, ou outros componentes.  
os outros prods ficam em zebra para facilitar a leitura.
# Padronização do registro de perdas (oficina por código e berço numerado)

## Conferências feitas antes do plano
- Permissões da capacidade por etapa: o admin já pode inserir e alterar (políticas `capacidade_insert_admin` e `capacidade_update_admin`). Nenhuma política nova é necessária.
- As linhas `dtf` e `silk` já existem nessa tabela (teto 700 e 900), então o upsert só de `etapa` + `qtd_bercos` atualiza sem tocar no teto.
- Diferença de caminho: este projeto grava mudanças de banco em `drizzle/migrations/` (ferramenta de migração do projeto, com registro em `meta/`), não em `supabase/migrations/`. A migração vai para lá, com o mesmo conteúdo exato abaixo. Se preferir parar aqui, me avise.

## Migração (única, só estes quatro comandos)
```sql
ALTER TABLE public.oficinas ADD COLUMN IF NOT EXISTS codigo integer;
CREATE UNIQUE INDEX IF NOT EXISTS oficinas_codigo_unico
  ON public.oficinas (codigo) WHERE codigo IS NOT NULL;
ALTER TABLE public.pcp_capacidade_etapa ADD COLUMN IF NOT EXISTS qtd_bercos integer;
ALTER TABLE public.cop_perdas ADD COLUMN IF NOT EXISTS berco text;
```
`types.ts` é regenerado automaticamente.

## Arquivo por arquivo
1. `src/lib/app-lists.ts`: `areaExigeOficina` passa a aceitar "costura" ou "oficina" (sem acento, minúsculo). Nova `tipoBercoDoProblema(area, problema)` → "dtf" | "silk" | null (só com "desfiad" + "berco" no problema; tipo pelo nome da área).
2. `src/hooks/use-bercos.ts` (novo): `useBercos()` com chave `["pcp_bercos"]` gerando D1..Dn / S1..Sn; `useSalvarBercos()` com upsert `onConflict: "etapa"` enviando só `etapa` e `qtd_bercos`, invalidando `["pcp_bercos"]`.
3. `src/components/pcp/BercosConfigCard.tsx` (novo): dois campos inteiros sem setas, exemplo "D1 até D10", botão Salvar, erro dentro do card. `configuracoes.tsx`: só renderiza o card no topo da seção listas, para admin.
4. `src/lib/cop.ts`: `Oficina.codigo`, `rotuloOficina`, `ordenarOficinas`. `CopConfigPanel.tsx`: campo Código no diálogo da oficina; código repetido (erro de índice único 23505) mostra "Já existe uma oficina com esse código." no diálogo; lista mostra código antes do nome.
5. `IdentificacaoErroCampos.tsx`: props `oficinaId/onOficinaChange/berco/onBercoChange`; select "Qual oficina? *" para Costura; select "Qual berço? *" quando o problema pede, ou aviso "Cadastre a quantidade de berços nas Configurações." sem exigir; limpa oficina/berço ao deixarem de valer; `validarIdentificacaoErro(v, oficinaId, berco, bercosDisponiveis)` com "Informe qual berço.".
6. `RegistrarPerdaManualDialog.tsx` e `PerdasTab.tsx`: remover campos próprios de Oficina e Berço; gravar só quando a regra pede; em edição de registro antigo sem a regra, manter o valor gravado. `PerdasTab` grava `berco`.
7. Refação (`RefacaoDialog`, `refacao-helpers`, `pedidos.ts` só `RefacaoEpisodio`, `RefacaoViewerButton`): tirar o filtro que escondia Costura; perguntar oficina/berço após o problema; campos opcionais `oficina_id`/`berco` no payload e no episódio; visualizador mostra Oficina e Berço quando existirem.
8. Romaneio (`RegistrarPerdaDialog`, `CorrigirLancamentoPerdaDialog`): só grupos externos, rótulo só com o nome da área; sem oficina/berço; lançamentos antigos exibidos como gravados.
9. `CorrigirPerdaDialog.tsx`: oficina obrigatória só para Costura; berço vira select só quando o problema pede.
10. `src/lib/perdas-consolidado.ts`: fonte PCP leva `oficina_id`, `oficina_nome`, `berco` do episódio; fonte aba Perdas leva `berco`. Sem mudança de cálculo.

## Fora do escopo / protegidos
Nenhum arquivo fora da lista; protegidos (cop-saldos, use-capacidade, admin.functions, schema-extras, RomaneioTab, ControlePerdasTab, package.json) não aparecem no diff. Nenhum dado existente é alterado.

## Ao final
Typecheck e diff completo em Arquivos. Não farei lançamentos de teste, porque o preview grava no banco real.

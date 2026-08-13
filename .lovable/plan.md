# Export completo do banco para um Supabase novo (São Paulo)

Objetivo: gerar um pacote de arquivos que permita recriar todo o banco atual em um projeto Supabase novo e vazio, na sua conta. Nada muda no app — ele continua rodando normalmente.

## O que será gerado

Todos os arquivos ficam em uma pasta de saída para você baixar:

1. `01-schema.sql` — estrutura completa: tipo `app_role`, as 47 tabelas do schema público, chaves, índices, as 13 funções do banco, os gatilhos de auditoria/atualização, RLS e políticas, e os GRANTs necessários.
2. `02-dados/*.csv` — um CSV por tabela com todos os registros atuais.
3. `03-import-dados.sql` — comandos de importação na ordem correta de dependências (pais antes dos filhos), para rodar via SQL Editor/psql.
4. `04-storage.md` + arquivos — inventário dos três buckets (`canhotos`, `layouts`, `sup-anexos`) e script para recriá-los; os arquivos em si são exportados junto.
5. `05-usuarios.csv` — lista de usuários (e-mail, nome, papel e permissões) para você recriar os acessos.
6. `LEIA-ME.md` — passo a passo de importação no projeto novo, na ordem certa, com avisos.

## Pontos importantes (destino vazio)

- Senhas de usuários não podem ser exportadas. No projeto novo, cada pessoa faz "esqueci minha senha" ou é convidada; os papéis e permissões vêm do `05-usuarios.csv`. Como os IDs de usuário mudam, os campos de "quem fez" nos históricos ficam preservados apenas pelo nome/e-mail registrado.
- A tabela `profiles` e os papéis dependem de usuários existirem primeiro: a importação deles fica em uma etapa separada, depois de recriar os acessos.
- O gatilho em `auth.users` (criação automática de perfil) está incluído no schema.
- Os logs de auditoria são importados com os gatilhos desativados, para não gerar registros duplicados.

## Detalhes técnicos

- O schema é montado a partir das 96 migrações já versionadas em `supabase/migrations/`, consolidadas em um único arquivo idempotente e conferidas contra o estado real do banco (catálogos `pg_catalog`/`information_schema`).
- Dados exportados via `COPY ... TO STDOUT WITH CSV HEADER`, um arquivo por tabela; colunas `jsonb` saem como texto JSON válido.
- Ordem de importação resolvida pelo grafo de chaves estrangeiras; auto-referências (ex.: `cops.cop_pai_id`) importadas em duas passagens.
- Nenhuma chave secreta é incluída nos arquivos.

## O que NÃO faz parte deste plano

- Não desconecta o Lovable Cloud (não é possível) e não aponta este app para outro banco.
- Não altera nenhum dado ou estrutura do banco atual — é somente leitura.

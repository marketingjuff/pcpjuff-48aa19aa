# Sob demanda por tamanho no Estoque mínimo

## Resultado

Cada linha de modelo + cor + tamanho poderá ser marcada como **Sob demanda**. A linha deixará de mostrar alerta ou fundo vermelho e não contará como defasada. A marcação ficará salva e poderá ser desfeita com **Voltar ao normal**.

Não alterar as pausas por modelo + cor da aba Necessidade, os cálculos de sugerido, o piso de produção, as cores, as permissões existentes ou o comportamento de Tab no campo Adotado.

## Plano por arquivo

### 1. Nova alteração de banco gerada em `drizzle/migrations/<novo arquivo>.sql`

Aplicar exclusivamente:

```sql
alter table public.plan_estoque_minimo
  add column if not exists sob_demanda boolean not null default false;
```

Nenhuma exclusão, recriação, mudança de tipo ou alteração de policies. Linhas existentes passam a ter `false`, mantendo os valores atuais, sem backfill.

**Ajuste necessário à allowlist do documento:** este projeto aplica mudanças de banco pela ferramenta oficial, que gera o arquivo em `drizzle/migrations/` e atualiza seus metadados automaticamente, não em `supabase/migrations/`. Não duplicar a alteração nos dois locais. A aprovação deste plano autoriza esses arquivos gerados.

### 2. `src/lib/plan.ts`

- Adicionar `sob_demanda: boolean` a `MinimoSalvo` e incluí-lo no select paginado de `usePlanMinimos`.
- Adicionar `sobDemanda: boolean` a `LinhaEstoqueMinimo`, preenchido com `salvo?.sob_demanda ?? false`.
- Calcular `defasado` somente quando a linha **não** for sob demanda, preservando a fórmula atual do limiar.
- Adicionar `sobDemanda?: boolean` a `MinimoParaSalvar` e gravar `sob_demanda: i.sobDemanda ?? false` no upsert de números.
- Criar `useSalvarSobDemanda` com as mesmas permissões existentes e invalidação de `PLAN_KEY`. Ao alternar, preservar o mínimo adotado e o sugerido na adoção já salvos. Para uma linha ainda não salva, criar mínimo zero e registrar o sugerido atual. Propagar erros para a tela.
- Não ligar esta marcação às pausas nem alterar a conta de necessidade de produção.

### 3. `src/components/plan/EstoqueMinimoTab.tsx`

- Na Situação, exibir nesta ordem: **Sob demanda** (`secondary`, sem alerta), aviso de defasado atual, **Adotado**, **Nunca definido**.
- Manter o fundo vermelho condicionado exclusivamente a `l.defasado`.
- Na última coluna, acrescentar botão `ghost`, `h-6 px-2 text-[11px]`, **Sob demanda** ou **Voltar ao normal**, apenas para `podeEditar`, com `stopPropagation` e bloqueio de cliques repetidos durante a gravação.
- Não mostrar **Aceitar N** em linhas sob demanda.
- Manter **Aceitar todas deste modelo** com seu comportamento atual; todos os itens enviados devem preservar a marcação de cada destino, inclusive se seu número for alterado em lote.
- Preservar `l.sobDemanda` em `gravar`, `aceitarTodas` e `itensDaColagem`. O helper de colagem atende tanto o botão ao lado de cada cor quanto o diálogo **Colar em...**.
- Copiar continua guardando apenas os números adotados: não copiar a marcação de origem nem transferi-la para o destino.
- Mostrar falhas de marcar/desmarcar no `setErro`, incluindo modelo, cor e tamanho, sem engolir erros.

**Contadores e filtro:** não precisam de lógica nova. O total do topo, o badge por modelo e **Mostrar só os defasados** já consultam `l.defasado`; com a nova fórmula, excluem automaticamente as linhas sob demanda.

### 4. `src/integrations/supabase/types.ts`

Somente regeneração automática pela ferramenta de banco; nenhuma edição manual.

### 5. Testes pequenos junto ao código do PLAN

**Exceção adicional à allowlist:** manter um arquivo de testes `src/lib/plan-estoque-minimo.test.ts` no projeto para proteger as novas regras. Não instalar dependências nem modificar outros arquivos da aplicação.

Cobrir valores concretos: adotado zero com sugerido positivo alerta normalmente; marcado não alerta; voltar ao normal restaura o alerta; ausência de marcação equivale a `false`; mudar número e colar preservam a marcação do destino; origem marcada não marca o destino; nova linha recebe adotado zero. Executar os testes antes de concluir.

## Verificação e entrega

- Confirmar no banco a presença da coluna, seu default e a ausência de alterações nos números existentes.
- Conferir a tela com uma sessão com permissão: marcar uma linha defasada com adotado zero, conferir badge/fundo/contadores/filtro, recarregar e voltar ao normal. Conferir também alteração de número e os dois caminhos de colagem, preservando as marcações.
- Conferir que o usuário sem permissão vê o badge, mas não os novos botões, se houver uma sessão adequada disponível; informar qualquer verificação indisponível.
- Conferir que Tab continua passando ao Adotado da linha seguinte.
- Informar o resultado da checagem automática de tipos e dos testes antes de dar por concluído. Não executar manualmente builds ou typechecks, conforme a regra do ambiente.
- Conferir o conjunto final de arquivos alterados: apenas os arquivos da aplicação listados acima, a alteração e metadados de banco gerados e o teste explicitado neste plano.

## Antes de implementar

Aguardar aprovação explícita deste plano, incluindo as exceções de localização da alteração de banco e do arquivo de testes. Nenhum código da aplicação ou mudança de banco foi feito.
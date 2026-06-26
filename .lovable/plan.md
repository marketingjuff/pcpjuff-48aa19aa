## COP — Prompt 1: estrutura base, Configurações e aba Corte

Implementação aditiva. Não toca em `pedidos`, nem na lógica do PCP, nem nas chaves atuais de `app_color_settings`.

### 1. Macro-abas COP / PCP (roteamento)

Abordagem proposta: **rota nova dedicada**, reaproveitando o mesmo layout (`_authenticated`).

- Mover o conteúdo atual de `src/routes/_authenticated/index.tsx` para um componente compartilhado `src/components/pcp/PcpHome.tsx` (apenas extração, sem mudança de lógica) e fazer `index.tsx` renderizá-lo.
- Criar `src/routes/_authenticated/cop.tsx` (rota `/cop`), gated por `useIsAdmin()` — não-admin é redirecionado para `/`.
- Adicionar no header (em `PcpHome` e na nova `CopHome`) um **macro-switch** "PCP | COP" à esquerda do logo. O botão COP só aparece se `isAdmin`. Navega via `navigate({to:"/"})` ou `navigate({to:"/cop"})`.
- Botão "Configurações" no header do COP navega para `/configuracoes?area=cop` (a página existente ganha um seletor de área PCP/COP — ver §3).

### 2. Página `/cop` — abas internas

`src/routes/_authenticated/cop.tsx` cria a página COP com `Tabs` no mesmo padrão visual, na ordem fixa:

`Dashboard COP · Disponível · Corte · Romaneio · Pagamento Oficinas · Falta por Pedido · Perdas`

Apenas **Corte** é funcional. As outras 6 abas renderizam um placeholder "Em construção" (componente simples reutilizável `CopEmConstrucao`).

Arquivos novos:
- `src/components/cop/CorteTab.tsx` (funcional)
- `src/components/cop/CopEmConstrucao.tsx` (placeholder)
- `src/components/cop/DivisaoCorteDialog.tsx`
- `src/components/cop/shared.tsx` (helpers, status, badges via `useCopColorSettings`)
- `src/lib/cop.ts` (tipos `Cop`, `CopPeca`, constantes de status, helpers)
- `src/hooks/use-cop-color-settings.ts`

### 3. Configurações do COP

Editar `src/routes/_authenticated/configuracoes.tsx` adicionando um **seletor de área no topo: "PCP | COP"** (default PCP; lê `?area=`). A árvore atual permanece intacta sob PCP. Sob COP exibe três blocos:

1. **Oficinas (CRUD)** — lista + dialog de edição: nome, CNPJ/CPF, endereço, CEP, valor_frete, e tabela "valor por modelo" alimentada por `REFACAO_MODELOS`.
2. **Cores das etapas e botões do COP** — mesmo componente visual do PCP, mas persistido em `app_color_settings` com `id = 'cop'` (aditivo; PCP continua em `id = 'global'`).
3. **Controle de acesso** — bloco informativo "Atualmente apenas ADM acessa o COP. (Em breve: Gestores com COP habilitado.)" Sem switches ativos.

Cores padrão das etapas COP (chaves):
- `Aguardando Risco`, `Aguardando Corte`, `Aguardando Romaneio`, `Em Oficina`, `Aguardando Pagamento`, `Finalizado`.

Cores padrão dos botões COP: `atualizar`, `mandar_romaneio`, `dividir_corte`, `voltar`.

### 4. Aba CORTE (funcional)

Topo grande no padrão `OrcamentoTitle`:
```
COP
0001
```
(se dividido: `0001 (0001/0047)` com o irmão como link clicável que troca o COP selecionado).

Layout no estilo das abas PCP: lista/tabela à esquerda + card de edição em cima quando há COP selecionado. Filtros: status (default "Aguardando Risco" + "Aguardando Corte"), busca por número.

Campos:
- **Número do COP** — auto, somente leitura.
- **Status** — badge colorido com `useCopColorSettings`.
- **Solicitação do Risco** / **Execução do Risco** / **Solicitação do Corte** / **Execução do Corte** — `DateInputBR`.
- **Descrição dos produtos** — editor de peças (reusa o padrão do `PecasPerdidasEditor`/`SolicitarPecasDialog`): linhas com dropdown Modelo, dropdown Cor (coloridas) e 7 inputs numéricos por tamanho (`PP P M G GG EXG EXXG`). Estado persistido em `pecas` jsonb como `[{modelo, cor, tamanho, qtd}]` (uma linha por tamanho), igual ao formato do PCP.
- **Observações do Corte** — `Textarea` uppercase.
- **Botões**: `Atualizar` (salva) · `Mandar pro Romaneio` (status → `Aguardando Romaneio`).
- **Divisão de Corte** (`DivisaoCorteDialog`): exibe as peças do COP atual com input "mover para novo COP" por linha (cap = qtd atual). Ao confirmar:
  - cria novo COP filho com status `Aguardando Risco`, `cop_pai_id = atual.id` e as peças movidas;
  - subtrai as quantidades no COP pai (remove linhas zeradas);
  - marca `corte_dividido = true` no pai.
  - Bloqueado se `corte_dividido = true` (já dividiu) ou se o COP atual tem `cop_pai_id` (é filho).
  - O par é mostrado consultando `cops` por `cop_pai_id = pai` e o próprio pai.

**Status inicial:** novo COP nasce com `status = 'Aguardando Risco'` direto na aba Corte (não há aba Risco).

### 5. Banco — migration aditiva

```sql
-- Oficinas
CREATE TABLE public.oficinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj_cpf text,
  endereco text,
  cep text,
  valor_frete numeric(12,2) DEFAULT 0,
  valores_por_modelo jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.oficinas TO authenticated;
GRANT ALL ON public.oficinas TO service_role;
ALTER TABLE public.oficinas ENABLE ROW LEVEL SECURITY;
CREATE POLICY oficinas_admin_all ON public.oficinas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Sequência para numero COP (começa em 1)
CREATE SEQUENCE IF NOT EXISTS public.cops_numero_seq START 1;

-- COPs
CREATE TABLE public.cops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero integer NOT NULL UNIQUE DEFAULT nextval('public.cops_numero_seq'),
  status text NOT NULL DEFAULT 'Aguardando Risco',
  solicitacao_risco date,
  execucao_risco date,
  solicitacao_corte date,
  execucao_corte date,
  observacoes_corte text,
  pecas jsonb NOT NULL DEFAULT '[]'::jsonb,
  cop_pai_id uuid REFERENCES public.cops(id) ON DELETE SET NULL,
  corte_dividido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cops TO authenticated;
GRANT ALL ON public.cops TO service_role;
ALTER TABLE public.cops ENABLE ROW LEVEL SECURITY;
CREATE POLICY cops_admin_all ON public.cops
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- updated_at triggers (reusa função já existente se houver; senão cria)
```

`app_color_settings` ganha **um novo registro** `id = 'cop'`. Sem alterar o registro `'global'` do PCP, sem alterar policies existentes. `types.ts` será regenerado para incluir `oficinas` e `cops`.

### 6. Arquivos a criar / editar

**Criar**
- `src/routes/_authenticated/cop.tsx`
- `src/components/cop/CorteTab.tsx`
- `src/components/cop/DivisaoCorteDialog.tsx`
- `src/components/cop/CopEmConstrucao.tsx`
- `src/components/cop/shared.tsx`
- `src/lib/cop.ts`
- `src/hooks/use-cop-color-settings.ts`
- migration SQL (oficinas, cops, sequence, policies, grants)

**Editar (mínimo)**
- `src/routes/_authenticated/index.tsx` → renderiza `PcpHome` (extração) + macro-switch PCP/COP no header.
- `src/components/pcp/PcpHome.tsx` (novo, recebe o corpo atual de `index.tsx` sem alterações de lógica).
- `src/routes/_authenticated/configuracoes.tsx` → seletor PCP/COP no topo + bloco COP (oficinas, cores COP, aviso de acesso).

### Pontos para confirmar antes de codar

1. **Roteamento**: ok usar rota dedicada `/cop` (com extração do conteúdo atual para `PcpHome`)? Alternativa é um estado macro dentro do mesmo `index.tsx` sem rota nova.
2. **Numeração**: usar `sequence` no Postgres (sempre crescente, sem reuso) — ok? O exibido continua sendo `String(numero).padStart(4,'0')`.
3. **Cor padrão dos botões COP**: posso reusar a paleta atual (`atualizar` azul, `voltar` vermelho) e definir `mandar_romaneio` verde, `dividir_corte` laranja?
4. **Configurações**: ok juntar PCP e COP na mesma página `/configuracoes` com seletor no topo, em vez de criar `/configuracoes/cop`?

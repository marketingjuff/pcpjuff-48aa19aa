# Plano: Checkbox de Warning na Aba Arte

## Objetivo
Adicionar uma coluna com checkbox na tabela da aba **Arte** (antes da coluna "Etapa") que permita aos operadores marcar/desmarcar pedidos como "importante". O header dessa coluna será o ícone de warning (`AlertTriangle`), e clicar nele filtra apenas os pedidos marcados. O estado é persistido no banco de dados e visível para todos.

## Escopo
- Aba **Arte** apenas (tabela desktop + cards mobile).
- Restrição de edição: **apenas operadores** podem marcar/desmarcar. Gestores e admins veem o checkbox desabilitado (read-only).
- O checkbox é puramente informativo/visual — não afeta cálculos de etapa, filtros de estágio nem regras de negócio.

---

## 1. Banco de Dados

### Migração SQL
Adicionar coluna `arte_warning` à tabela existente `pedidos`:

```sql
ALTER TABLE public.pedidos ADD COLUMN arte_warning boolean NOT NULL DEFAULT false;
```

**Nota:** A tabela `pedidos` já possui RLS e policies existentes (`pedidos_select_team`, `pedidos_update_team`, `pedidos_insert_team`, `pedidos_delete_admin_gestor`). Como a policy `UPDATE` permite qualquer membro da equipe (`is_team_member()`) e a restrição de "apenas operadores" é um requisito de interface, a validação será feita no frontend (checkbox desabilitado para não-operadores). Não há necessidade de criar policy por coluna.

---

## 2. Tipos TypeScript

Atualizar o tipo `Pedido` em `src/lib/pedidos.ts` e `PedidoExtras` em `src/integrations/supabase/schema-extras.ts` para incluir:

```ts
arte_warning: boolean | null;
```

---

## 3. Frontend — Aba Arte (`ArteTab.tsx`)

### 3.1 Tabela Desktop
- Inserir nova coluna **imediatamente antes da coluna "Etapa"** no `<table>`.
- **Header (`<th>`):** renderizar o ícone `AlertTriangle` (lucide-react) em amarelo (`text-yellow-500`). O `<th>` deve ser clicável e atuar como filtro: quando clicado, alterna entre "mostrar todos" e "mostrar apenas marcados".
- **Célula (`<td>`):** renderizar um `<Checkbox>` (componente `@radix-ui/react-checkbox`) cuja marcação reflete `pedido.arte_warning`.
- **Interação do checkbox:**
  - Ao clicar, chama `onSave({ id: pedido.id, arte_warning: !pedido.arte_warning })`.
  - Desabilitado (`disabled`) quando o usuário logado **não é operador** (gestor ou admin não podem alterar).
- **Tooltip no header:** ao passar o mouse, exibir "Filtrar pedidos marcados com warning".

### 3.2 Cards Mobile
- No `PedidoMobileCard` (ou equivalente usado na aba Arte), adicionar um ícone de `AlertTriangle` pequeno (ou checkbox) no canto superior direito quando o pedido estiver marcado.
- O checkbox no mobile também deve respeitar a regra de "apenas operadores".

### 3.3 Filtro de Dashboard
- Adicionar estado local `fWarning` (boolean | null) no `ArteTab`.
- Quando `fWarning === true`, filtrar `dashboardRows` para manter apenas pedidos onde `p.arte_warning === true`.
- O header clicável do warning controla esse estado.

---

## 4. Reutilização
- Não será reutilizado em outras abas neste momento, pois o requisito é específico da Arte.
- O componente de checkbox e o comportamento de filtro seguem o padrão já existente nos filtros da aba (ex: `fEtapa`, `fSearch`).

---

## 5. Critérios de Aceitação
1. [ ] A coluna de warning aparece **antes** da coluna "Etapa" na tabela da aba Arte.
2. [ ] O header da coluna exibe o ícone `AlertTriangle` (amarelo) e é clicável.
3. [ ] Clicar no header alterna o filtro entre "todos" e "apenas marcados com warning".
4. [ ] Cada linha exibe um checkbox que reflete o estado salvo no banco (`arte_warning`).
5. [ ] Operadores conseguem marcar/desmarcar o checkbox e o estado persiste no banco.
6. [ ] Gestores e admins veem o checkbox, mas não conseguem clicar (desabilitado).
7. [ ] O número de registros no header do card "Dashboard — Arte" continua correto após aplicar o filtro.
8. [ ] O checkbox não afeta cálculos de etapa, travas de edição nem regras de negócio.

## 6. Arquivos a serem modificados
- `src/lib/pedidos.ts` — tipo `Pedido`.
- `src/integrations/supabase/schema-extras.ts` — tipo `PedidoExtras`.
- `src/components/pcp/ArteTab.tsx` — tabela, filtros, checkbox, integração com Supabase.
- **Nova migração** — coluna `arte_warning` na tabela `pedidos`.
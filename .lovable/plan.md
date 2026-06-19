## Painel de Configuração de Cores

### 1. Armazenamento (Lovable Cloud)
Nova tabela `app_color_settings` com 1 linha singleton (`id = 'global'`) e coluna `data jsonb`. Estrutura:
```json
{
  "etapas": { "Aguardando Arte": { "fg": "#3730a3", "bg": "#eef2ff" }, ... },
  "botoes": {
    "atualizar":  { "fg": "#ffffff", "bg": "#2563eb" },
    "finalizar":  { "fg": "#ffffff", "bg": "#059669" },
    "voltar":     { "fg": "#ffffff", "bg": "#475569" }
  }
}
```
RLS: leitura por `authenticated`; escrita só para `has_role(auth.uid(), 'admin')`. GRANT padrão. Sem migração de tipos extras (uso direto via supabase client).

### 2. Hook `useColorSettings`
`src/hooks/use-color-settings.ts`:
- `useQuery(['color-settings'])` lê a linha singleton, com fallback aos defaults atuais (paleta já em `etapaPaletteClass` convertida para hex).
- Helpers: `etapaStyle(etapa)` → `{ color, backgroundColor, borderColor }`; `btnStyle('atualizar' | 'finalizar' | 'voltar')`.
- Mutation `saveColorSettings` (admin only) faz upsert.
- Invalidação em todas as abas via mesmo queryKey.

### 3. Aba "Cores" em Configurações (admin only)
Em `src/routes/_authenticated/configuracoes.tsx`:
- Novo `TabsTrigger value="cores"` visível só para admin.
- Componente `CoresTab`: lista as 11 etapas do badge + 3 botões. Cada linha tem 2 `<input type="color">` (fundo / fonte) e um preview ao vivo. Botões "Restaurar padrão" e "Salvar".
- As etapas configuráveis são todas as do badge: Aguardando entrada, Aguardando input de produção, Aguardando Arte, DTF Pronto / Silk na Arte, Silk Pronto / DTF na Arte, Aguardando DTF, Aguardando Silk, Aguardando DTF + Silk, Aguardando Acabamento, Aguardando Expedição, Finalizado.

### 4. Aplicar cores nos badges de etapa
Em `src/components/pcp/shared.tsx`:
- `EtapaBadgeFromPedido` e demais usos passam a aceitar `style` derivado do hook. Onde a `Badge` é renderizada via `etapaPaletteClass`, substituir por `<Badge variant="outline" style={etapaStyle(etapa)}>`.
- `etapaPaletteClass` permanece como fallback caso o hook ainda não tenha carregado.

### 5. Botões uniformes
- **Atualizar**: criar `<UpdateButton>` em `shared.tsx` que aplica `style={btnStyle('atualizar')}` (azul por padrão). Substituir todos os `<Button>Atualizar ...</Button>` em ArteTab, DTFTab, SilkTab, AcabamentoTab, ExpedicaoTab, DadosInTab (2 botões "Atualizar/Salvar Input").
- **Finalizar Pedido / Finalizar selecionados** em ExpedicaoTab: trocar `bg-emerald-600 hover:bg-emerald-700 text-white` por `style={btnStyle('finalizar')}` (verde por padrão).
- **Voltar (VoltarDropdown)**: o botão "Voltar" interno usa `style={btnStyle('voltar')}`.

### 6. Alinhamento do VoltarDropdown
Em **todas as abas que têm Voltar** (ArteTab, DTFTab, SilkTab, AcabamentoTab, ExpedicaoTab), a barra de ações vira:
```
[Voltar ▼]                    ...                    [Atualizar]
```
Implementação: container `flex items-center justify-between w-full` (em mobile vira `flex-col-reverse gap-2`). Hoje em ExpedicaoTab eles estão lado a lado num `flex-wrap`; mover `VoltarDropdown` para a esquerda e `Atualizar`/`Finalizar` para a direita. Mesma estrutura nas demais abas.

### 7. Detalhes técnicos
- Cores aplicadas via `style={{ backgroundColor, color, borderColor }}` (não via classes Tailwind) para permitir valores arbitrários do usuário.
- `borderColor` = mesmo `bg` com opacidade ~40% (computado via `color-mix` inline ou helper hex→rgba).
- Dark mode: usuário escolhe uma cor única; mantemos a mesma em ambos os temas (simples e previsível). Se quiser separar light/dark, fica para uma próxima iteração.
- Defaults vêm de uma constante `DEFAULT_COLOR_SETTINGS` em `use-color-settings.ts` espelhando as cores Tailwind atuais convertidas para hex.

### Arquivos
- **Migração**: cria `app_color_settings` (id text PK, data jsonb, updated_at) + RLS + GRANT.
- **Novo**: `src/hooks/use-color-settings.ts`.
- **Editar**: `src/routes/_authenticated/configuracoes.tsx` (nova aba), `src/components/pcp/shared.tsx` (badges + UpdateButton), `src/components/pcp/VoltarDropdown.tsx` (cor do botão), `ArteTab.tsx`, `DTFTab.tsx`, `SilkTab.tsx`, `AcabamentoTab.tsx`, `ExpedicaoTab.tsx`, `DadosInTab.tsx` (uniformizar Atualizar + reposicionar Voltar).

Sem alteração nos schemas de auth/storage. Tudo respeita o gate `_authenticated`.

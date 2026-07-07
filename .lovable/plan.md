## Nova aba "Estoque de MP" no MAP (placeholder)

### Escopo
- **Editar:** `src/routes/_authenticated/map.tsx`
- **Criar:** `src/components/map/EstoqueMpTab.tsx`
- Sem banco, sem migration, sem toque no Supabase.

### 1) `src/routes/_authenticated/map.tsx`
- Adicionar import: `import { EstoqueMpTab } from "@/components/map/EstoqueMpTab";`
- Adicionar entrada `{ value: "estoque", label: "Estoque de MP" }` ao array `TABS`.
- Adicionar `TabsContent` logo após o de `finalizados`:
```tsx
<TabsContent value="estoque" forceMount hidden={tab !== "estoque"}>
  <EstoqueMpTab />
</TabsContent>
```

### 2) `src/components/map/EstoqueMpTab.tsx` (novo)
```tsx
export function EstoqueMpTab() {
  return (
    <div className="rounded-lg border border-dashed border-border/60 bg-card/40 p-10 text-center">
      <h2 className="text-lg font-semibold tracking-tight">Estoque de MP</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Em breve. Aqui entrará somente o que efetivamente chegou da tinturaria.
      </p>
    </div>
  );
}
```

Nenhum outro arquivo é tocado.

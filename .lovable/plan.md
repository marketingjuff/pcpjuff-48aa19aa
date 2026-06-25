## Problema

Em `src/components/pcp/DadosInTab.tsx`, `handleDuplicar` faz:

1. `onSelect(null)` — limpa a seleção no pai
2. `setForm({...dados duplicados...})`

O `useEffect([selected])` (linhas 73–81) roda em seguida e, como `isDirty` ainda é `false`, executa `setForm(selected ?? empty)` → sobrescreve o formulário duplicado com `empty`. Resultado: formulário aparece em branco.

## Correção

Adicionar um ref-guard que faz o `useEffect` de sincronização ignorar a próxima mudança de `selected` quando a origem é a duplicação.

### Mudança em `src/components/pcp/DadosInTab.tsx`

1. Criar `const skipNextSelectedSync = useRef(false);`
2. No `useEffect([selected])`, no topo:
   ```ts
   if (skipNextSelectedSync.current) {
     skipNextSelectedSync.current = false;
     return;
   }
   ```
3. Reescrever `handleDuplicar`:
   ```ts
   function handleDuplicar() {
     if (!selected) return;
     const dup = { ...empty, /* mesmos campos atuais */ };
     skipNextSelectedSync.current = true;
     onSelect(null);
     setForm(dup);
   }
   ```

Com isso, o pai zera `selected`, o effect é pulado uma vez, e o `form` permanece com os dados duplicados (e marcado como dirty, pronto para "Salvar" criar um novo pedido).

Nenhuma outra alteração necessária — a whitelist de campos copiados/zerados permanece igual à implementação atual.
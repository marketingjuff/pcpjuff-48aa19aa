## Substituir ícone do header pelo logo Juff

**Arquivo:** `src/routes/_authenticated/index.tsx` (linhas 165-167)

**O que muda:**
1. Upload do `logoazuloficial.jpg` como Lovable Asset (`src/assets/logo-juff.jpg.asset.json`).
2. Substituir o bloco atual (div com ícone `Factory`) por um `<img>` com o logo, mantendo o mesmo tamanho (`h-10 w-10`) e cantos arredondados (`rounded-xl`), com `object-cover` para preencher o quadrado.
3. Remover o import de `Factory` se não for mais usado em outro lugar do arquivo.

**Resultado:** logo azul Juff aparece no topo esquerdo, ao lado do título "PCP Juff", com bordas arredondadas, mantendo o mesmo footprint visual do ícone atual.
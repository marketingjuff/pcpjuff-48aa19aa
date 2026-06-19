## Reorganização do trecho abaixo de "Baixar layout" na aba Arte

Arquivo único: `src/components/pcp/ArteTab.tsx` (linhas 203–294). Nada acima da linha 202 será tocado. Sem novos arquivos, sem mudanças de estilo/tamanho, sem mudança de lógica de negócio. Reaproveita `showDTF` / `showSilk` (já equivalentes a `visivelEmDTF` / `visivelEmSilk`) e os mesmos `FormField` / `Select` / `DateInputBR` / `Textarea` atuais.

### 1. Seção "DTF" (condicional a `showDTF`)
- Título de texto simples acima do grid: `<h4>DTF</h4>` (classe neutra, sem cor/ícone, ex.: `text-sm font-medium`).
- Todos os campos na MESMA linha (um único grid, mesmas classes de grid já usadas):
  1. Vetorização de DTF Realizada (se `showVetorDTF`)
  2. DTF Impresso
  3. Data DTF Impresso (se `form.dtf_impresso === "Sim"`)
  4. DTF Cortado
  5. Data DTF Cortado (se `form.dtf_cortado === "Sim"`)
  6. Quem cortou o DTF? (se `form.dtf_cortado === "Sim"`)

### 2. Seção "Silk" (condicional a `showSilk`)
- Título de texto simples: `<h4>Silk</h4>`.
- Todos os campos na MESMA linha:
  1. Vetorização de Silk Realizada (se `showVetorSilk`)
  2. Fotolito Impresso
  3. Data de Impressão do Fotolito (se `form.fotolito_impresso === "Sim"`)

Em pedidos DTF+Silk as duas seções aparecem; em pedidos de um tipo só, apenas a correspondente — comportamento já garantido por `showDTF` / `showSilk`.

### 3. Seção "Observações e anotações"
- Título de texto simples: `<h4>Observações e anotações</h4>`.
- Inverter a ordem do bloco atual:
  - PRIMEIRO: campo "Observações da Arte" (Textarea + `ObservacoesOutrosSetores`).
  - DEPOIS: campo "Anotações da Arte" (Select `status_arte`).
- Mantém o mesmo grid/colspans atuais, só trocando a ordem dos dois blocos internos.

### 4. Botão "Atualizar Arte"
- Permanece exatamente onde está, logo abaixo da última seção.

### Observação técnica
O label do Select `status_arte` hoje está como "Anotações da Arte" e o Textarea `arte_observacao` como "Observações da Arte" — mantenho esses labels como estão (a reordenação pede "Observações primeiro, Anotações depois", o que é satisfeito invertendo os dois blocos sem renomear nada).
## Plano — 3 ajustes na aba PCP

Implementarei um item por vez, confirmando a cada conclusão.

---

### 1. Aba Arte — trocar "Saída Juff" por "Início de Acabamento"

**Origem da data automática (proposta):** usar o campo `inicio_acabamento` que já existe no pedido. Ele é calculado automaticamente em `DadosInTab` (a partir de `entrada_pedido` + dias úteis) e gravado no banco — não é digitado. Mesmo campo já exibido como leitura nas abas DTF, Silk e Acabamento.

**Mudanças em `src/components/pcp/ArteTab.tsx`:**

- Card do pedido selecionado (linha ~190): substituir
`<ReadOnlyField label="Saída Juff" value={formatDateBR(selected.saida_juff)} />`
por
`<ReadOnlyField label="Início de Acabamento" value={formatDateBR(selected.inicio_acabamento)} />`.
- Tabela (linha ~427 cabeçalho e ~452 célula): trocar coluna "SAÍDA JUFF" por "INÍCIO ACAB." mostrando `p.inicio_acabamento`; ajustar o sort (`case "saida"` → `case "iniAcab"`, comparando `inicio_acabamento`).

Nenhuma mudança nas outras abas — "Saída Juff", se houver, continua nelas como hoje.

---

### 2. Trava de edição progressiva — apenas operadores

Vale só quando `canManage = false` (operador). Admin/gestor seguem livres (a função `isReadOnly` já tem `if (canManage) return false`).

**Mudanças em `src/components/pcp/edicao-policy.ts`:**

- `canEditDTF(p)`: além das checagens atuais, exigir que a arte do DTF tenha sido liberada. Isto é, `p.dtf_arte === "Sim"` (campo que indica "DTF Liberado pela arte"). Enquanto a arte do DTF não estiver pronta, o operador vê os campos DTF como somente leitura. Após salvar (`p.dtf_estampado === "Sim"`), trava.
- `canEditSilk(p)`: idem, exigir `p.silk_arte === "Sim"` (Silk liberado pela arte). Após `p.silk_feito === "Sim"`, trava.
- `canEditAcabamento(p)`: já está correto — só libera quando `etapaAtualSemAsterisco === "Aguardando Acabamento"` (ou seja, arte/DTF/silk concluídos). Após `embalado === "Sim"`, trava.
- `canEditArte(p)`: continua como está — operador edita até `status_arte === "Arte Finalizada"`, depois trava.

Confirmarei os nomes exatos dos flags de "arte liberada por lado" lendo `Pedido` antes de codar (provavelmente `dtf_arte` / `silk_arte` ou `dtf_arte_finalizada` / `fotolito_finalizado`). Se o nome divergir, ajusto.

Como `isReadOnly` é consumido por todas as 4 abas e aplicado via `<fieldset disabled={readOnly}>`, a UI já reflete corretamente: campos cinza/desabilitados quando bloqueados, com o aviso "Esta etapa já foi concluída… Visualização somente leitura." Atualizarei o texto para também cobrir o caso "etapa ainda não liberada".

---

### 3. Aba Expedição — botão "Finalizar pedido" só com tudo OK

**Mudança em `src/components/pcp/ExpedicaoTab.tsx`:**

- Já existe `todosCompletos(selected, form)` que retorna `true` quando todos os itens da forma de pagamento estão marcados como `Sim`.
- Atualizar o `<FinalizarButton>` (linha ~295) para:
`disabled={saving || !todosCompletos(selected, form)}`
- Vale para todos os perfis (admin, gestor, operador) — sem exceção.
- Quando desabilitado, adicionar `title="Finalize todas as pendências da expedição antes de concluir o pedido"` para feedback.

---

Aprovando, começo pelo item 1.
## Ajustes no cadastro de Oficinas (COP)

### Banco

Migração na tabela `oficinas`:

- Adicionar `cnpj text` e `cpf text` (separados).
- Adicionar `telefone text`.
- Adicionar `observacoes text` (livre, multi-linha — usado para dados bancários).
- Manter `cnpj_cpf` por compatibilidade (não remover agora); novos registros gravam nos campos novos.

### UI — `src/components/cop/CopConfigPanel.tsx` (OficinaDialog)

Novo layout de campos, na ordem:

1. Nome
2. CNPJ (input próprio) | CPF (input próprio) — dois campos lado a lado
3. CEP
4. Endereço completo
5. **Telefone** (novo, logo após endereço)
6. Valor do frete
7. Tabela de valores por modelo (mantida)
8. **Observações** (novo `Textarea` no final, largura total)

Coluna da tabela de listagem: mostrar `cnpj || cpf` (fallback para `cnpj_cpf` legado) para não quebrar registros antigos.

### Fora do escopo

- Máscara/validação de CNPJ/CPF/telefone.
- Migrar dados existentes de `cnpj_cpf` para os novos campos.
- Exibir observações/telefone em outros lugares (romaneio, pagamento) — apenas cadastro.
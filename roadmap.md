# KPI Juff Store — Venda real
- [x] Corrigir exclusão de peças zeradas pelo desconto de pedido (plano aprovado).
- [x] Ignorar quantidades não positivas sem classificá-las como voucher ou venda real; usar piso zero no preço líquido do filtro.
- [x] Verificar cálculos e outubro/2026 na tela, sem temporários no repositório: 29 verificações passaram; 52 pedidos/114 peças reais; 58 pedidos/62 peças excluídos; compilação automática OK; navegador sem erros.
- [ ] Typecheck separado solicitado — execução manual indisponível por regra do ambiente; log automático informa somente build OK, sem resultado separado de tipos.
- [x] Acrescentar cálculo e segunda faixa sem voucher, preservando demais indicadores.
- [x] Disponibilizar limite em Configurações > KPI somente para admin.
- [x] Conferir cálculos (16 casos), tela autenticada, tipos e ausência de temporários no repositório.
- Conferência real: receita total R$ 80.962,54; real R$ 80.660,32; voucher R$ 0,03; diferença R$ 302,19 sinalizada, sem mudar a fórmula aprovada. Peças: 1.550 + 11 = 1.561. Limite R$ 20,00 salvo e relido pela tela.
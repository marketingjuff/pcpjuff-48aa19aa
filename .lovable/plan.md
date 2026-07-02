# Correções: Saldo Disponível (COP) + Baixas preservadas (PCP Dados In)

Frontend-only. Sem migração, sem alterar `src/lib/cop-saldos.ts`.

## 1. `src/components/cop/DisponivelTab.tsx` — célula sempre mostra o SALDO
- Trocar `const display = !presente ? "—" : temFalta ? \`-${falt}\` : v;` por `const display = !presente ? "—" : v;`.
- Manter cores: vermelho quando `temFalta || v < 0`; âmbar quando `v === 0`; verde quando positivo sem falta.
- Atualizar `title` da célula para `Produção X · Faltantes Y · Recebido Z · Perdas W`, com `perd = perdas.get(pkKey(l.modelo, l.cor, t)) ?? 0`.

## 2. `src/components/cop/DisponivelTab.tsx` — popup do item
- Trocar rótulo `Baixado:` por `Recebido:`.
- Adicionar linha `Perdas: <valor>` entre Recebido e Saldo (usar `perdas.get(pkKey(popup...))`).
- Substituir `const saldo = prod - falt - baix;` por `const saldo = disponivel.get(pkKey(popup.modelo, popup.cor, popup.tamanho)) ?? 0;`.

## 3. `src/components/pcp/DadosInTab.tsx` — saves não revertem baixas
- Em `saveVendor` e `saveProducao`: montar payload e `delete payload.pecas_solicitadas; delete payload.pecas_completadas_log;` antes de `onSave`.
- Exceção `saveProducao`: quando `form.status_pecas === "incompleto" && tudoEnviado`, aplicar reset `pecas_solicitadas: []` **depois** do delete.
- Em `salvarPecasSolicitadas`: mesclar `qtd_enviada` de `selected.pecas_solicitadas` (mais recente) via `Math.min(qtd, Math.max(qtd_enviada_local, qtd_enviada_selected))`.
- Não alterar `liberarParaCompleto` nem outras abas.

## Escopo
Apenas `DisponivelTab.tsx` e `DadosInTab.tsx`.
